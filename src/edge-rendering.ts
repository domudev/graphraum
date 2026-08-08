import { type BufferGeometry, Color, InstancedBufferAttribute, PlaneGeometry, ShaderMaterial } from "three";

import type { EdgeMarkerInstance, EdgeSegmentInstance } from "./edge-materialize";
import { encodeEdgeStyle } from "./edge-styles";

const vertexShader = `
attribute float instanceKind;
attribute vec3 instanceEndA;
attribute vec3 instanceEndB;
attribute vec4 instanceColor;
attribute float instanceWidth;
attribute float instanceStyle;

varying vec4 edgeColor;
varying float edgeKind;
varying float edgeStyle;
varying float edgeDashT;
varying vec2 edgeUv;

void main() {
	edgeColor = instanceColor;
	edgeKind = instanceKind;
	edgeStyle = instanceStyle;
	edgeUv = uv;
	edgeDashT = 0.0;

	vec4 viewA = modelViewMatrix * vec4(instanceEndA, 1.0);
	vec4 viewB = modelViewMatrix * vec4(instanceEndB, 1.0);
	vec4 viewPosition;

	if (instanceKind < 0.5) {
		// Segment: stretch the unit quad from EndA to EndB in view space.
		vec2 delta = viewB.xy - viewA.xy;
		float len = length(delta);
		vec2 dir = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
		vec2 perp = vec2(-dir.y, dir.x);
		vec2 mid = (viewA.xy + viewB.xy) * 0.5;
		vec2 offset = dir * position.x * len + perp * position.y * instanceWidth;
		float depth = mix(viewA.z, viewB.z, position.x + 0.5);
		viewPosition = vec4(mid + offset, depth, 1.0);
		edgeDashT = (position.x + 0.5) * len / max(instanceWidth * 4.0, 0.0001);
	} else {
		// Marker: oriented triangle with its apex pinned to EndA, pointing
		// along EndA -> EndB (the direction of travel), base trailing behind.
		vec2 dirVec = viewB.xy - viewA.xy;
		float dirLen = length(dirVec);
		vec2 dir = dirLen > 0.0001 ? dirVec / dirLen : vec2(1.0, 0.0);
		vec2 perp = vec2(-dir.y, dir.x);
		float t = position.x + 0.5;
		vec2 offset = dir * instanceWidth * (t - 1.0) + perp * position.y * instanceWidth;
		viewPosition = vec4(viewA.xy + offset, viewA.z, 1.0);
	}

	gl_Position = projectionMatrix * viewPosition;
}
`;

const fragmentShader = `
varying vec4 edgeColor;
varying float edgeKind;
varying float edgeStyle;
varying float edgeDashT;
varying vec2 edgeUv;

void main() {
	if (edgeKind < 0.5) {
		if (edgeStyle > 0.5) {
			float cell = fract(edgeDashT);
			if (edgeStyle < 1.5) {
				if (cell > 0.6) discard; // dashed
			} else {
				if (abs(cell - 0.5) > 0.15) discard; // dotted
			}
		}
	} else {
		// Triangle SDF: apex at edgeUv.x == 1, full width base at edgeUv.x == 0.
		float halfWidth = (1.0 - edgeUv.x) * 0.5;
		if (abs(edgeUv.y - 0.5) > halfWidth) discard;
	}
	if (edgeColor.a <= 0.0) discard;
	gl_FragColor = edgeColor;
}
`;

export function createEdgeGeometry(capacity: number): BufferGeometry {
	const geometry = new PlaneGeometry(1, 1);
	geometry.setAttribute("instanceKind", new InstancedBufferAttribute(new Float32Array(capacity), 1));
	geometry.setAttribute("instanceEndA", new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
	geometry.setAttribute("instanceEndB", new InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
	geometry.setAttribute("instanceColor", new InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
	geometry.setAttribute("instanceWidth", new InstancedBufferAttribute(new Float32Array(capacity), 1));
	geometry.setAttribute("instanceStyle", new InstancedBufferAttribute(new Float32Array(capacity), 1));
	return geometry;
}

export function createEdgeMaterial(depthTest: boolean): ShaderMaterial {
	return new ShaderMaterial({
		depthTest,
		depthWrite: depthTest,
		fragmentShader,
		transparent: true,
		vertexShader,
	});
}

function getInstancedAttribute(geometry: BufferGeometry, name: string): InstancedBufferAttribute {
	const attribute = geometry.getAttribute(name);
	if (!(attribute instanceof InstancedBufferAttribute)) {
		throw new Error(`edge geometry is missing the "${name}" instanced attribute`);
	}
	return attribute;
}

export function writeEdgeSegmentInstance(geometry: BufferGeometry, slot: number, segment: EdgeSegmentInstance): void {
	const kind = getInstancedAttribute(geometry, "instanceKind");
	const endA = getInstancedAttribute(geometry, "instanceEndA");
	const endB = getInstancedAttribute(geometry, "instanceEndB");
	const color = getInstancedAttribute(geometry, "instanceColor");
	const width = getInstancedAttribute(geometry, "instanceWidth");
	const style = getInstancedAttribute(geometry, "instanceStyle");

	kind.setX(slot, 0);
	endA.setXYZ(slot, segment.x1, segment.y1, segment.z1);
	endB.setXYZ(slot, segment.x2, segment.y2, segment.z2);
	const rgb = new Color(segment.color);
	color.setXYZW(slot, rgb.r, rgb.g, rgb.b, segment.opacity);
	width.setX(slot, segment.width);
	style.setX(slot, encodeEdgeStyle(segment.style));
}

export function writeEdgeMarkerInstance(geometry: BufferGeometry, slot: number, marker: EdgeMarkerInstance): void {
	const kind = getInstancedAttribute(geometry, "instanceKind");
	const endA = getInstancedAttribute(geometry, "instanceEndA");
	const endB = getInstancedAttribute(geometry, "instanceEndB");
	const color = getInstancedAttribute(geometry, "instanceColor");
	const width = getInstancedAttribute(geometry, "instanceWidth");
	const style = getInstancedAttribute(geometry, "instanceStyle");

	kind.setX(slot, 1);
	endA.setXYZ(slot, marker.x, marker.y, marker.z);
	endB.setXYZ(slot, marker.x + marker.dx, marker.y + marker.dy, marker.z + marker.dz);
	const rgb = new Color(marker.color);
	color.setXYZW(slot, rgb.r, rgb.g, rgb.b, marker.opacity);
	width.setX(slot, marker.size);
	style.setX(slot, 0);
}
