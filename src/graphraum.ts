import {
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	type Material,
	Matrix4,
	MeshBasicMaterial,
	MOUSE,
	OrthographicCamera,
	PerspectiveCamera,
	Raycaster,
	Scene,
	SphereGeometry,
	Vector2,
	Vector3,
	WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { compileGraph } from "./compile-graph";
import type { GraphraumData, GraphraumDiagnostics, GraphraumMode, GraphraumOptions, GraphraumTheme } from "./types";

const defaultTheme: GraphraumTheme = {
	background: "#09090b",
	edge: "#3f3f46",
	node: "#a1a1aa",
	selectedNode: "#f59e0b",
};

type GraphraumCamera = OrthographicCamera | PerspectiveCamera;

function disposeMaterial(material: Material | Material[]) {
	for (const item of Array.isArray(material) ? material : [material]) item.dispose();
}

/** A small, explicit WebGL graph renderer: one instanced node mesh and one batched edge geometry. */
export class Graphraum {
	private readonly container: HTMLElement;
	private readonly renderer: WebGLRenderer;
	private readonly scene = new Scene();
	private readonly raycaster = new Raycaster();
	private readonly pointer = new Vector2();
	private readonly theme: GraphraumTheme;
	private readonly resizeObserver: ResizeObserver;
	private camera: GraphraumCamera;
	private controls: OrbitControls;
	private data: GraphraumData = { nodes: [], edges: [] };
	private nodeIds: readonly string[] = [];
	private nodeMesh: InstancedMesh | null = null;
	private edgeLines: LineSegments | null = null;
	private selectedNodeIds = new Set<string>();
	private mode: GraphraumMode;
	private frameRequest: number | null = null;

	constructor(container: HTMLElement, options: GraphraumOptions = {}) {
		this.container = container;
		this.mode = options.mode ?? "2d";
		this.theme = { ...defaultTheme, ...options.theme };
		this.scene.background = new Color(this.theme.background);
		this.renderer = new WebGLRenderer({ antialias: options.antialias ?? false });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 2));
		this.renderer.domElement.style.display = "block";
		this.renderer.domElement.style.height = "100%";
		this.renderer.domElement.style.width = "100%";
		this.container.append(this.renderer.domElement);

		this.camera = this.createCamera();
		this.controls = this.createControls();
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(container);
		this.resize();
	}

	setData(data: GraphraumData) {
		const compiled = compileGraph(data);
		this.disposeGraphObjects();
		this.data = data;
		this.nodeIds = compiled.nodeIds;

		const nodeGeometry = new SphereGeometry(1, 8, 6);
		const nodeMaterial = new MeshBasicMaterial({ color: "#ffffff" });
		const nodeMesh = new InstancedMesh(nodeGeometry, nodeMaterial, data.nodes.length);
		const matrix = new Matrix4();
		for (const [index, node] of data.nodes.entries()) {
			const size = node.size ?? 4;
			matrix.makeScale(size, size, size);
			matrix.setPosition(node.position.x, node.position.y, node.position.z ?? 0);
			nodeMesh.setMatrixAt(index, matrix);
			nodeMesh.setColorAt(index, new Color(node.color ?? this.theme.node));
		}
		nodeMesh.instanceMatrix.needsUpdate = true;
		if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
		this.nodeMesh = nodeMesh;
		this.scene.add(nodeMesh);

		const edgeGeometry = new BufferGeometry();
		edgeGeometry.setAttribute("position", new BufferAttribute(compiled.edgePositions, 3));
		const edgeLines = new LineSegments(
			edgeGeometry,
			new LineBasicMaterial({ color: this.theme.edge, transparent: true, opacity: 0.55 }),
		);
		this.edgeLines = edgeLines;
		this.scene.add(edgeLines);

		this.applySelectionColors();
		this.fitView();
	}

	setSelection(nodeIds: Iterable<string>) {
		this.selectedNodeIds = new Set(nodeIds);
		this.applySelectionColors();
		this.requestRender();
	}

	setMode(mode: GraphraumMode) {
		if (mode === this.mode) return;
		this.mode = mode;
		this.controls.removeEventListener("change", this.requestRender);
		this.controls.dispose();
		this.camera = this.createCamera();
		this.controls = this.createControls();
		this.fitView();
	}

	getMode() {
		return this.mode;
	}

	getDiagnostics(): GraphraumDiagnostics {
		return { gpuDrawCalls: this.renderer.info.render.calls };
	}

	pick(clientX: number, clientY: number): string | null {
		if (!this.nodeMesh) return null;
		const bounds = this.renderer.domElement.getBoundingClientRect();
		this.pointer.set(
			((clientX - bounds.left) / bounds.width) * 2 - 1,
			-((clientY - bounds.top) / bounds.height) * 2 + 1,
		);
		this.raycaster.setFromCamera(this.pointer, this.camera);
		const hit = this.raycaster.intersectObject(this.nodeMesh, false)[0];
		return hit?.instanceId === undefined ? null : (this.nodeIds[hit.instanceId] ?? null);
	}

	fitView() {
		if (!this.nodeMesh || this.data.nodes.length === 0) {
			this.requestRender();
			return;
		}

		const bounds = new Box3().setFromObject(this.nodeMesh);
		const center = bounds.getCenter(new Vector3());
		const size = bounds.getSize(new Vector3());
		const width = Math.max(this.container.clientWidth, 1);
		const height = Math.max(this.container.clientHeight, 1);
		const aspect = width / height;

		if (this.camera instanceof OrthographicCamera) {
			const visibleHeight = Math.max(size.y, size.x / aspect, 1) * 1.15;
			this.camera.left = (-visibleHeight * aspect) / 2;
			this.camera.right = (visibleHeight * aspect) / 2;
			this.camera.top = visibleHeight / 2;
			this.camera.bottom = -visibleHeight / 2;
			this.camera.position.set(center.x, center.y, center.z + Math.max(size.z, 1000));
		} else {
			const radius = Math.max(size.length() / 2, 1);
			const distance = radius / Math.sin((this.camera.fov * Math.PI) / 360);
			this.camera.position.set(center.x, center.y, center.z + distance * 1.15);
			this.camera.near = Math.max(distance / 10_000, 0.1);
			this.camera.far = distance * 10;
		}

		this.camera.lookAt(center);
		this.camera.updateProjectionMatrix();
		this.controls.target.copy(center);
		this.controls.update();
		this.requestRender();
	}

	resize() {
		const width = Math.max(this.container.clientWidth, 1);
		const height = Math.max(this.container.clientHeight, 1);
		this.renderer.setSize(width, height, false);
		if (this.camera instanceof PerspectiveCamera) {
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
		}
		this.requestRender();
	}

	destroy() {
		this.resizeObserver.disconnect();
		this.controls.removeEventListener("change", this.requestRender);
		this.controls.dispose();
		if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
		this.disposeGraphObjects();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	private readonly requestRender = () => {
		if (this.frameRequest !== null) return;
		this.frameRequest = requestAnimationFrame(() => {
			this.frameRequest = null;
			this.renderer.render(this.scene, this.camera);
		});
	};

	private createCamera(): GraphraumCamera {
		return this.mode === "2d"
			? new OrthographicCamera(-1, 1, 1, -1, -100_000, 100_000)
			: new PerspectiveCamera(45, 1, 0.1, 100_000);
	}

	private createControls() {
		const controls = new OrbitControls(this.camera, this.renderer.domElement);
		controls.enableDamping = false;
		controls.enableRotate = this.mode === "3d";
		controls.screenSpacePanning = true;
		if (this.mode === "2d") controls.mouseButtons.LEFT = MOUSE.PAN;
		controls.addEventListener("change", this.requestRender);
		return controls;
	}

	private applySelectionColors() {
		if (!this.nodeMesh) return;
		for (const [index, node] of this.data.nodes.entries()) {
			this.nodeMesh.setColorAt(
				index,
				new Color(this.selectedNodeIds.has(node.id) ? this.theme.selectedNode : (node.color ?? this.theme.node)),
			);
		}
		if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
	}

	private disposeGraphObjects() {
		if (this.nodeMesh) {
			this.scene.remove(this.nodeMesh);
			this.nodeMesh.geometry.dispose();
			disposeMaterial(this.nodeMesh.material);
			this.nodeMesh = null;
		}
		if (this.edgeLines) {
			this.scene.remove(this.edgeLines);
			this.edgeLines.geometry.dispose();
			disposeMaterial(this.edgeLines.material);
			this.edgeLines = null;
		}
	}
}
