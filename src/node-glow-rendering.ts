import {
	AdditiveBlending,
	Color,
	InstancedBufferAttribute,
	InstancedMesh,
	Matrix4,
	NormalBlending,
	PlaneGeometry,
	type Scene,
	ShaderMaterial,
} from "three";

import {
	createGlowSelection,
	GLOW_MAX_INSTANCES,
	type GlowBlendMode,
	glowBufferCapacity,
	glowHaloOpacity,
	glowHaloRadius,
	glowOpacityScale,
	selectGlowNodes,
} from "./node-glow";
import { OUTPUT_COLOR_SPACE_FRAGMENT } from "./shader-output";

/** Below the edge and node meshes so halos never cover graph elements. */
export const GLOW_RENDER_ORDER = -2;

// `instanceColor` is injected by Three.js when InstancedMesh.instanceColor is set.
const vertexShader = `
attribute float instanceGlowOpacity;
varying vec3 glowColor;
varying vec2 glowPoint;
varying float glowOpacity;

void main() {
	glowColor = instanceColor;
	glowPoint = position.xy;
	glowOpacity = instanceGlowOpacity;
	vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
	center.xy += position.xy * length(instanceMatrix[0].xyz);
	gl_Position = projectionMatrix * center;
}
`;

const fragmentShader = `
uniform float opacityScale;
varying vec3 glowColor;
varying vec2 glowPoint;
varying float glowOpacity;

void main() {
	float distanceFromCenter = length(glowPoint);
	if (distanceFromCenter >= 1.0) discard;
	float falloff = 1.0 - distanceFromCenter;
	gl_FragColor = vec4(glowColor, falloff * falloff * glowOpacity * opacityScale);
	${OUTPUT_COLOR_SPACE_FRAGMENT}
}
`;

/** One glow instance; the renderer fills a single reused target per node, never a new object. */
export interface GlowNodeTarget {
	color: Color;
	/** Node half-extent `max(width, height)` in world units. */
	extent: number;
	glow: number;
	x: number;
	y: number;
	z: number;
}

export type DescribeGlowNode = (nodeIndex: number, target: GlowNodeTarget) => boolean;

type GlowMesh = InstancedMesh<PlaneGeometry, ShaderMaterial>;

function applyBlendMode(material: ShaderMaterial, mode: GlowBlendMode) {
	material.blending = mode === "normal" ? NormalBlending : AdditiveBlending;
	const opacityScale = material.uniforms.opacityScale;
	if (opacityScale) opacityScale.value = glowOpacityScale(mode);
	material.needsUpdate = true;
}

export function createNodeGlowMaterial(mode: GlowBlendMode): ShaderMaterial {
	const material = new ShaderMaterial({
		depthTest: false,
		depthWrite: false,
		fragmentShader,
		transparent: true,
		uniforms: { opacityScale: { value: 1 } },
		vertexShader,
	});
	applyBlendMode(material, mode);
	return material;
}

function createGlowMesh(capacity: number, mode: GlowBlendMode): GlowMesh {
	const geometry = new PlaneGeometry(2, 2);
	geometry.setAttribute("instanceGlowOpacity", new InstancedBufferAttribute(new Float32Array(capacity), 1));
	const mesh: GlowMesh = new InstancedMesh(geometry, createNodeGlowMaterial(mode), capacity);
	mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
	mesh.name = "graphraum-node-glow";
	mesh.frustumCulled = false;
	mesh.renderOrder = GLOW_RENDER_ORDER;
	return mesh;
}

/**
 * Opt-in batched halo pass: one additive instanced mesh, created lazily on the first glowing
 * node and hidden while no halo is selected, so graphs without glow keep two draw calls.
 */
export class NodeGlowLayer {
	private readonly scene: Scene;
	private readonly selection = createGlowSelection();
	private readonly target: GlowNodeTarget = { color: new Color(), extent: 0, glow: 0, x: 0, y: 0, z: 0 };
	private readonly matrix = new Matrix4();
	private mesh: GlowMesh | null = null;
	private blendMode: GlowBlendMode = "additive";

	constructor(scene: Scene) {
		this.scene = scene;
	}

	/** Additive on dark or unknown backgrounds, normal on light solid ones; see `glowBlendModeFor`. */
	setBlending(mode: GlowBlendMode) {
		if (mode === this.blendMode) return;
		this.blendMode = mode;
		if (this.mesh) applyBlendMode(this.mesh.material, mode);
	}

	/** Halo instances in the current frame. */
	get count(): number {
		return this.mesh?.visible ? this.mesh.count : 0;
	}

	/** Reselects glowing visible nodes and rewrites every halo instance. */
	sync(
		visibleNodeIndices: readonly number[],
		glowAt: (nodeIndex: number) => number,
		densityLod: boolean,
		describe: DescribeGlowNode,
	) {
		selectGlowNodes(visibleNodeIndices, glowAt, densityLod, this.selection);
		if (this.selection.count > 0) this.ensureCapacity(this.selection.count);
		this.rewrite(describe);
	}

	/** Rewrites positions, radii, opacities, and colors of the current selection in place. */
	rewrite(describe: DescribeGlowNode) {
		const mesh = this.mesh;
		if (!mesh) return;
		const opacity = mesh.geometry.getAttribute("instanceGlowOpacity") as InstancedBufferAttribute;
		let slot = 0;
		for (let index = 0; index < this.selection.count; index += 1) {
			const nodeIndex = this.selection.indices[index];
			if (nodeIndex === undefined || !describe(nodeIndex, this.target)) continue;
			const { color, extent, glow, x, y, z } = this.target;
			const radius = glowHaloRadius(extent, glow);
			this.matrix.makeScale(radius, radius, radius).setPosition(x, y, z);
			mesh.setMatrixAt(slot, this.matrix);
			mesh.setColorAt(slot, color);
			opacity.setX(slot, glowHaloOpacity(glow));
			slot += 1;
		}
		mesh.count = slot;
		mesh.visible = slot > 0;
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		opacity.needsUpdate = true;
	}

	/** Releases the GPU mesh; the layer stays reusable and recreates it on the next glowing node. */
	dispose() {
		this.selection.count = 0;
		this.releaseMesh();
	}

	private releaseMesh() {
		if (!this.mesh) return;
		this.scene.remove(this.mesh);
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
		this.mesh.dispose();
		this.mesh = null;
	}

	private ensureCapacity(required: number) {
		const current = this.mesh?.instanceMatrix.count ?? 0;
		const capacity = glowBufferCapacity(required, current, GLOW_MAX_INSTANCES);
		if (this.mesh && capacity === current) return;
		this.releaseMesh();
		this.mesh = createGlowMesh(capacity, this.blendMode);
		this.scene.add(this.mesh);
	}
}
