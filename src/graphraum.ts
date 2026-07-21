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
import { prepareNodeUpdates } from "./node-updates";
import { type Bounds2D, SpatialGrid2D } from "./spatial-grid-2d";
import type {
	GraphraumData,
	GraphraumDiagnostics,
	GraphraumMode,
	GraphraumNodeUpdate,
	GraphraumOptions,
	GraphraumTheme,
} from "./types";
import { applyEdgeBudget, collectIncidentEdges } from "./viewport-lod";

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
	private readonly maxVisibleEdges: number;
	private readonly viewportCulling: boolean;
	private readonly viewportOverscan: number;
	private camera: GraphraumCamera;
	private controls: OrbitControls;
	private data: GraphraumData = { nodes: [], edges: [] };
	private nodeIds: readonly string[] = [];
	private nodeIndices = new Map<string, number>();
	private edgeNodeIndices: Uint32Array = new Uint32Array();
	private canonicalEdgePositions: Float32Array = new Float32Array();
	private incidentEdgeIndices: readonly (readonly number[])[] = [];
	private spatialGrid2d = new SpatialGrid2D();
	private nodeMesh: InstancedMesh | null = null;
	private edgeLines: LineSegments | null = null;
	private selectedNodeIds = new Set<string>();
	private visibleNodeSlots = new Map<number, number>();
	private visibleEdgeSlots = new Map<number, number>();
	private visibleNodeIndices: readonly number[] = [];
	private visibleNodeCount = 0;
	private visibleEdgeCount = 0;
	private visibleEdgeCandidateCount = 0;
	private mode: GraphraumMode;
	private frameRequest: number | null = null;

	constructor(container: HTMLElement, options: GraphraumOptions = {}) {
		this.container = container;
		this.mode = options.mode ?? "2d";
		this.maxVisibleEdges = options.maxVisibleEdges ?? 100_000;
		this.viewportCulling = options.viewportCulling ?? true;
		this.viewportOverscan = options.viewportOverscan ?? 16;
		if (!Number.isSafeInteger(this.maxVisibleEdges) || this.maxVisibleEdges < 1) {
			throw new Error("Maximum visible edges must be a positive integer.");
		}
		if (!Number.isFinite(this.viewportOverscan) || this.viewportOverscan < 0) {
			throw new Error("Viewport overscan must be a non-negative finite number.");
		}
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
		this.data = {
			edges: data.edges.map((edge) => ({ ...edge })),
			nodes: data.nodes.map((node) => ({ ...node, position: { ...node.position } })),
		};
		this.nodeIds = compiled.nodeIds;
		this.nodeIndices = new Map(compiled.nodeIndices);
		this.edgeNodeIndices = compiled.edgeNodeIndices;
		this.canonicalEdgePositions = compiled.edgePositions;
		this.incidentEdgeIndices = compiled.incidentEdgeIndices;
		this.spatialGrid2d = new SpatialGrid2D();
		for (const [index, node] of this.data.nodes.entries()) this.spatialGrid2d.set(index, node);

		const nodeGeometry = new SphereGeometry(1, 8, 6);
		const nodeMaterial = new MeshBasicMaterial({ color: "#ffffff" });
		const nodeMesh = new InstancedMesh(nodeGeometry, nodeMaterial, data.nodes.length);
		const matrix = new Matrix4();
		for (const [index, node] of data.nodes.entries()) {
			const size = node.size ?? 4;
			matrix.makeScale(size, size, size);
			matrix.setPosition(node.position.x, node.position.y, node.position.z ?? 0);
			nodeMesh.setMatrixAt(index, matrix);
			nodeMesh.setColorAt(
				index,
				new Color(this.selectedNodeIds.has(node.id) ? this.theme.selectedNode : (node.color ?? this.theme.node)),
			);
		}
		nodeMesh.instanceMatrix.needsUpdate = true;
		if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
		this.nodeMesh = nodeMesh;
		this.scene.add(nodeMesh);

		const edgeGeometry = new BufferGeometry();
		edgeGeometry.setAttribute("position", new BufferAttribute(compiled.edgePositions.slice(), 3));
		const edgeLines = new LineSegments(
			edgeGeometry,
			new LineBasicMaterial({ color: this.theme.edge, transparent: true, opacity: 0.55 }),
		);
		this.edgeLines = edgeLines;
		this.scene.add(edgeLines);

		this.fitView();
	}

	updateNodes(updates: readonly GraphraumNodeUpdate[]) {
		if (updates.length === 0) return;
		if (!this.nodeMesh || !this.edgeLines) throw new Error("Cannot update nodes before graph data is set");
		const prepared = prepareNodeUpdates(this.data.nodes, this.nodeIndices, updates);
		const nodes = [...this.data.nodes];
		const matrix = new Matrix4();
		const edgePosition = this.edgeLines.geometry.getAttribute("position") as BufferAttribute;
		const renderedEdgePositions = edgePosition.array as Float32Array;
		const viewportBounds = this.getViewportBounds2d();
		let visibilityChanged = false;

		for (const update of prepared) {
			nodes[update.index] = update.next;
			if (update.positionChanged || update.sizeChanged) {
				const wasVisible = this.visibleNodeSlots.has(update.index);
				this.spatialGrid2d.set(update.index, update.next);
				visibilityChanged ||= wasVisible !== this.isNodeVisible2d(update.next, viewportBounds);
			}
			const nodeSlot = this.visibleNodeSlots.get(update.index);
			if (update.positionChanged || update.sizeChanged) {
				if (nodeSlot !== undefined) {
					const size = update.next.size ?? 4;
					matrix.makeScale(size, size, size);
					matrix.setPosition(update.next.position.x, update.next.position.y, update.next.position.z ?? 0);
					this.nodeMesh.setMatrixAt(nodeSlot, matrix);
					this.nodeMesh.instanceMatrix.addUpdateRange(nodeSlot * 16, 16);
				}
			}
			if (update.colorChanged && !this.selectedNodeIds.has(update.next.id) && nodeSlot !== undefined) {
				this.nodeMesh.setColorAt(nodeSlot, new Color(update.next.color ?? this.theme.node));
				this.nodeMesh.instanceColor?.addUpdateRange(nodeSlot * 3, 3);
			}
			if (update.positionChanged) {
				for (const edgeIndex of this.incidentEdgeIndices[update.index] ?? []) {
					const sourceIndex = this.edgeNodeIndices[edgeIndex * 2];
					const canonicalOffset = edgeIndex * 6 + (sourceIndex === update.index ? 0 : 3);
					const values = [update.next.position.x, update.next.position.y, update.next.position.z ?? 0];
					this.canonicalEdgePositions.set(values, canonicalOffset);
					const edgeSlot = this.visibleEdgeSlots.get(edgeIndex);
					if (edgeSlot !== undefined) {
						const renderedOffset = edgeSlot * 6 + (sourceIndex === update.index ? 0 : 3);
						renderedEdgePositions.set(values, renderedOffset);
						edgePosition.addUpdateRange(renderedOffset, 3);
					}
				}
			}
		}

		this.data = { ...this.data, nodes };
		if (visibilityChanged) {
			this.materializeViewport();
			this.requestRender();
			return;
		}
		if (prepared.some((update) => update.positionChanged || update.sizeChanged)) {
			this.nodeMesh.instanceMatrix.needsUpdate = true;
		}
		if (prepared.some((update) => update.colorChanged) && this.nodeMesh.instanceColor) {
			this.nodeMesh.instanceColor.needsUpdate = true;
		}
		if (prepared.some((update) => update.positionChanged)) edgePosition.needsUpdate = true;
		this.requestRender();
	}

	setSelection(nodeIds: Iterable<string>) {
		const nextSelection = new Set(nodeIds);
		const changedNodeIds = new Set(
			[...this.selectedNodeIds, ...nextSelection].filter(
				(nodeId) => this.selectedNodeIds.has(nodeId) !== nextSelection.has(nodeId),
			),
		);
		this.selectedNodeIds = nextSelection;
		this.applySelectionColors(changedNodeIds);
		this.requestRender();
	}

	/** Schedules one render on the next animation frame. Repeated calls in one frame are coalesced. */
	render() {
		this.requestRender();
	}

	setMode(mode: GraphraumMode) {
		if (mode === this.mode) return;
		this.mode = mode;
		this.controls.removeEventListener("change", this.handleViewChange);
		this.controls.dispose();
		this.camera = this.createCamera();
		this.controls = this.createControls();
		this.fitView();
	}

	getMode() {
		return this.mode;
	}

	getDiagnostics(): GraphraumDiagnostics {
		return {
			gpuDrawCalls: this.renderer.info.render.calls,
			lodLevel: this.visibleEdgeCandidateCount > this.visibleEdgeCount ? "overview" : "detail",
			pickingStrategy: this.mode === "2d" ? "spatial-grid-2d" : "raycaster-3d",
			visibleEdgeCandidates: this.visibleEdgeCandidateCount,
			visibleEdges: this.visibleEdgeCount,
			visibleNodes: this.visibleNodeCount,
		};
	}

	pick(clientX: number, clientY: number): string | null {
		if (!this.nodeMesh) return null;
		const bounds = this.renderer.domElement.getBoundingClientRect();
		this.pointer.set(
			((clientX - bounds.left) / bounds.width) * 2 - 1,
			-((clientY - bounds.top) / bounds.height) * 2 + 1,
		);
		if (this.camera instanceof OrthographicCamera) {
			const world = new Vector3(this.pointer.x, this.pointer.y, 0).unproject(this.camera);
			const index = this.spatialGrid2d.pick(world.x, world.y);
			return index === null ? null : (this.nodeIds[index] ?? null);
		}
		this.raycaster.setFromCamera(this.pointer, this.camera);
		const hit = this.raycaster.intersectObject(this.nodeMesh, false)[0];
		const nodeIndex = hit?.instanceId === undefined ? undefined : this.visibleNodeIndices[hit.instanceId];
		return nodeIndex === undefined ? null : (this.nodeIds[nodeIndex] ?? null);
	}

	fitView() {
		if (!this.nodeMesh || this.data.nodes.length === 0) {
			this.requestRender();
			return;
		}

		const bounds = new Box3();
		const minimum = new Vector3();
		const maximum = new Vector3();
		for (const node of this.data.nodes) {
			const radius = node.size ?? 4;
			const z = node.position.z ?? 0;
			bounds.expandByPoint(minimum.set(node.position.x - radius, node.position.y - radius, z - radius));
			bounds.expandByPoint(maximum.set(node.position.x + radius, node.position.y + radius, z + radius));
		}
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
		this.materializeViewport();
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
		this.materializeViewport();
		this.requestRender();
	}

	destroy() {
		this.resizeObserver.disconnect();
		this.controls.removeEventListener("change", this.handleViewChange);
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

	private readonly handleViewChange = () => {
		this.materializeViewport();
		this.requestRender();
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
		controls.addEventListener("change", this.handleViewChange);
		return controls;
	}

	private applySelectionColors(nodeIds: Iterable<string>) {
		if (!this.nodeMesh) return;
		for (const nodeId of nodeIds) {
			const index = this.nodeIndices.get(nodeId);
			if (index === undefined) continue;
			const slot = this.visibleNodeSlots.get(index);
			if (slot === undefined) continue;
			const node = this.data.nodes[index];
			if (!node) continue;
			this.nodeMesh.setColorAt(
				slot,
				new Color(this.selectedNodeIds.has(nodeId) ? this.theme.selectedNode : (node.color ?? this.theme.node)),
			);
		}
		if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
	}

	private getViewportBounds2d(): Bounds2D | null {
		if (!(this.camera instanceof OrthographicCamera) || !this.viewportCulling) return null;
		const bottomLeft = new Vector3(-1, -1, 0).unproject(this.camera);
		const topRight = new Vector3(1, 1, 0).unproject(this.camera);
		return { bottom: bottomLeft.y, left: bottomLeft.x, right: topRight.x, top: topRight.y };
	}

	private isNodeVisible2d(node: GraphraumData["nodes"][number], bounds: Bounds2D | null) {
		if (!bounds) return true;
		const radius = node.size ?? 4;
		return (
			node.position.x + radius >= bounds.left - this.viewportOverscan &&
			node.position.x - radius <= bounds.right + this.viewportOverscan &&
			node.position.y + radius >= bounds.bottom - this.viewportOverscan &&
			node.position.y - radius <= bounds.top + this.viewportOverscan
		);
	}

	private materializeViewport() {
		if (!this.nodeMesh || !this.edgeLines) return;
		const bounds = this.getViewportBounds2d();
		const visibleNodeIndices = bounds
			? this.spatialGrid2d.queryBounds(bounds, this.viewportOverscan)
			: this.data.nodes.map((_, index) => index);
		const edgeCandidates = bounds
			? collectIncidentEdges(visibleNodeIndices, this.incidentEdgeIndices)
			: this.data.edges.map((_, index) => index);
		const visibleEdgeIndices = applyEdgeBudget(edgeCandidates, this.maxVisibleEdges);
		const matrix = new Matrix4();
		this.visibleNodeSlots = new Map();
		this.visibleNodeIndices = visibleNodeIndices;
		this.nodeMesh.instanceMatrix.clearUpdateRanges();
		this.nodeMesh.instanceColor?.clearUpdateRanges();
		for (const [slot, nodeIndex] of visibleNodeIndices.entries()) {
			const node = this.data.nodes[nodeIndex];
			if (!node) continue;
			this.visibleNodeSlots.set(nodeIndex, slot);
			const size = node.size ?? 4;
			matrix.makeScale(size, size, size);
			matrix.setPosition(node.position.x, node.position.y, node.position.z ?? 0);
			this.nodeMesh.setMatrixAt(slot, matrix);
			this.nodeMesh.setColorAt(
				slot,
				new Color(this.selectedNodeIds.has(node.id) ? this.theme.selectedNode : (node.color ?? this.theme.node)),
			);
		}
		this.nodeMesh.count = visibleNodeIndices.length;
		this.nodeMesh.instanceMatrix.addUpdateRange(0, visibleNodeIndices.length * 16);
		this.nodeMesh.instanceMatrix.needsUpdate = true;
		if (this.nodeMesh.instanceColor) {
			this.nodeMesh.instanceColor.addUpdateRange(0, visibleNodeIndices.length * 3);
			this.nodeMesh.instanceColor.needsUpdate = true;
		}

		const edgePosition = this.edgeLines.geometry.getAttribute("position") as BufferAttribute;
		const renderedEdgePositions = edgePosition.array as Float32Array;
		edgePosition.clearUpdateRanges();
		this.visibleEdgeSlots = new Map();
		for (const [slot, edgeIndex] of visibleEdgeIndices.entries()) {
			this.visibleEdgeSlots.set(edgeIndex, slot);
			renderedEdgePositions.set(this.canonicalEdgePositions.subarray(edgeIndex * 6, edgeIndex * 6 + 6), slot * 6);
		}
		this.edgeLines.geometry.setDrawRange(0, visibleEdgeIndices.length * 2);
		edgePosition.addUpdateRange(0, visibleEdgeIndices.length * 6);
		edgePosition.needsUpdate = true;

		this.visibleNodeCount = visibleNodeIndices.length;
		this.visibleEdgeCandidateCount = edgeCandidates.length;
		this.visibleEdgeCount = visibleEdgeIndices.length;
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
