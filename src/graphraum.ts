import {
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	type InstancedBufferAttribute,
	InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	type Material,
	Matrix4,
	MeshBasicMaterial,
	MOUSE,
	OrthographicCamera,
	PerspectiveCamera,
	Plane,
	Raycaster,
	Scene,
	SphereGeometry,
	Vector2,
	Vector3,
	WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { compileGraph } from "./compile-graph";
import { prepareLayoutPositions } from "./layout-positions";
import { createNodeGeometry, createNodeMaterial, setNodeShapeAt } from "./node-rendering";
import { containsNodePoint } from "./node-shapes";
import { type PreparedNodeUpdate, prepareNodeUpdates } from "./node-updates";
import { GraphraumOverlay } from "./overlay";
import { type Bounds2D, SpatialGrid2D } from "./spatial-grid-2d";
import { graphraumTheme } from "./theme";
import type {
	CompiledGraphraumPresentation,
	GraphraumData,
	GraphraumDataPatch,
	GraphraumDiagnostics,
	GraphraumLayoutPositions,
	GraphraumMode,
	GraphraumNodeState,
	GraphraumNodeUpdate,
	GraphraumOptions,
	GraphraumOverlayOptions,
	GraphraumScreenPosition,
	GraphraumTheme,
	GraphraumVisualMapper,
} from "./types";
import { applyEdgeBudget, collectIncidentEdges, shouldUseDensityLod } from "./viewport-lod";

type GraphraumCamera = OrthographicCamera | PerspectiveCamera;
type GraphraumGraphObjects = {
	edgeLines: LineSegments;
	nodeMesh: InstancedMesh;
	nodePickMesh: InstancedMesh;
};

interface MaterializedNode {
	index: number;
	size: number;
	x: number;
	y: number;
	z: number;
}

interface GpuTimer {
	extension: { GPU_DISJOINT_EXT: number; TIME_ELAPSED_EXT: number };
	context: WebGL2RenderingContext;
	pending: WebGLQuery[];
}

function disposeMaterial(material: Material | Material[]) {
	for (const item of Array.isArray(material) ? material : [material]) item.dispose();
}

/** A small, explicit WebGL graph renderer: one instanced node mesh and one batched edge geometry. */
export class Graphraum<NodeAttributes = undefined, EdgeAttributes = undefined> {
	private readonly container: HTMLElement;
	private readonly renderer: WebGLRenderer;
	private readonly scene = new Scene();
	private readonly raycaster = new Raycaster();
	private readonly pointer = new Vector2();
	private readonly pickCenter = new Vector3();
	private readonly pickRight = new Vector3();
	private readonly theme: GraphraumTheme;
	private readonly resizeObserver: ResizeObserver;
	private readonly maxVisibleEdges: number;
	private readonly maxVisibleNodes: number;
	private readonly viewportCulling: boolean;
	private readonly viewportOverscan: number;
	private readonly visuals: GraphraumVisualMapper<NodeAttributes, EdgeAttributes> | undefined;
	private camera: GraphraumCamera;
	private controls: OrbitControls;
	private data: GraphraumData<NodeAttributes, EdgeAttributes> = { nodes: [], edges: [] };
	private nodeIds: readonly string[] = [];
	private nodeIndices = new Map<string, number>();
	private edgeNodeIndices: Uint32Array = new Uint32Array();
	private canonicalEdgePositions: Float32Array = new Float32Array();
	private canonicalEdgeColors: Float32Array = new Float32Array();
	private incidentEdgeIndices: readonly (readonly number[])[] = [];
	private nodePresentations = new Map<string, CompiledGraphraumPresentation>();
	private edgePresentations = new Map<string, CompiledGraphraumPresentation>();
	private spatialGrid2d = new SpatialGrid2D();
	private nodeMesh: InstancedMesh | null = null;
	private nodePickMesh: InstancedMesh | null = null;
	private edgeLines: LineSegments | null = null;
	private nodeCapacity = 0;
	private edgeCapacity = 0;
	private selectedNodeIds = new Set<string>();
	private hoveredNodeIds = new Set<string>();
	private focusedNodeIds = new Set<string>();
	private dimmedNodeIds = new Set<string>();
	private visibleNodeSlots = new Map<number, number>();
	private visibleEdgeSlots = new Map<number, number>();
	private visibleNodeIndices: readonly number[] = [];
	private visibleNodeCount = 0;
	private visibleNodeCandidateCount = 0;
	private densityLodActive = false;
	private visibleEdgeCount = 0;
	private visibleEdgeCandidateCount = 0;
	private mode: GraphraumMode;
	private frameRequest: number | null = null;
	private cpuFrameMilliseconds = 0;
	private gpuFrameMilliseconds: number | null = null;
	private gpuTimer: GpuTimer | null = null;
	private readonly viewListeners = new Set<() => void>();

	constructor(container: HTMLElement, options: GraphraumOptions<NodeAttributes, EdgeAttributes> = {}) {
		this.container = container;
		this.mode = options.mode ?? "2d";
		this.maxVisibleEdges = options.maxVisibleEdges ?? 100_000;
		this.maxVisibleNodes = options.maxVisibleNodes ?? 100_000;
		this.viewportCulling = options.viewportCulling ?? true;
		this.viewportOverscan = options.viewportOverscan ?? 16;
		this.visuals = options.visuals;
		if (!Number.isSafeInteger(this.maxVisibleEdges) || this.maxVisibleEdges < 1) {
			throw new Error("Maximum visible edges must be a positive integer.");
		}
		if (!Number.isSafeInteger(this.maxVisibleNodes) || this.maxVisibleNodes < 1) {
			throw new Error("Maximum visible nodes must be a positive integer.");
		}
		if (!Number.isFinite(this.viewportOverscan) || this.viewportOverscan < 0) {
			throw new Error("Viewport overscan must be a non-negative finite number.");
		}
		this.theme = { ...graphraumTheme, ...options.theme };
		this.scene.background = new Color(this.theme.background);
		this.renderer = new WebGLRenderer({ antialias: options.antialias ?? false });
		const context = this.renderer.getContext();
		if (typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext) {
			const extension = context.getExtension("EXT_disjoint_timer_query_webgl2");
			if (extension) this.gpuTimer = { context, extension, pending: [] };
		}
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

	setData(data: GraphraumData<NodeAttributes, EdgeAttributes>) {
		this.replaceData(data, true);
	}

	/** Merge a topology patch without fitting or resetting the current camera. */
	applyDataPatch(patch: GraphraumDataPatch<NodeAttributes, EdgeAttributes>) {
		const addedNodeIds = new Set((patch.addedNodes ?? []).map((node) => node.id));
		const addedEdgeIds = new Set((patch.addedEdges ?? []).map((edge) => edge.id));
		if (addedNodeIds.size !== (patch.addedNodes ?? []).length) throw new Error("Duplicate added node ID.");
		if (addedEdgeIds.size !== (patch.addedEdges ?? []).length) throw new Error("Duplicate added edge ID.");
		if (this.canAppendDataPatch(patch)) {
			this.appendDataPatch(patch);
			return;
		}
		const removedNodes = new Set(patch.removedNodeIds ?? []);
		const removedEdges = new Set(patch.removedEdgeIds ?? []);
		const nodes = new Map(this.data.nodes.map((node) => [node.id, node]));
		const edges = new Map(this.data.edges.map((edge) => [edge.id, edge]));

		for (const id of removedNodes) nodes.delete(id);
		for (const id of removedEdges) edges.delete(id);
		for (const node of patch.addedNodes ?? []) nodes.set(node.id, node);
		for (const edge of patch.addedEdges ?? []) edges.set(edge.id, edge);

		const validEdges = [...edges.values()].filter((edge) => nodes.has(edge.source) && nodes.has(edge.target));
		this.replaceData({ nodes: [...nodes.values()], edges: validEdges }, false);
	}

	private canAppendDataPatch(patch: GraphraumDataPatch<NodeAttributes, EdgeAttributes>) {
		if (!this.nodeMesh || !this.nodePickMesh || !this.edgeLines) return false;
		if ((patch.removedNodeIds?.length ?? 0) > 0 || (patch.removedEdgeIds?.length ?? 0) > 0) return false;
		const nodeIds = new Set(this.data.nodes.map((node) => node.id));
		if ((patch.addedNodes ?? []).some((node) => nodeIds.has(node.id))) return false;
		const edgeIds = new Set(this.data.edges.map((edge) => edge.id));
		if ((patch.addedEdges ?? []).some((edge) => edgeIds.has(edge.id))) return false;
		const allNodeIds = new Set([...nodeIds, ...(patch.addedNodes ?? []).map((node) => node.id)]);
		return (
			(patch.addedNodes?.length ?? 0) + this.data.nodes.length <= this.nodeCapacity &&
			(patch.addedEdges?.length ?? 0) + this.data.edges.length <= this.edgeCapacity &&
			(patch.addedEdges ?? []).every((edge) => allNodeIds.has(edge.source) && allNodeIds.has(edge.target))
		);
	}

	private appendDataPatch(patch: GraphraumDataPatch<NodeAttributes, EdgeAttributes>) {
		const addedNodes = patch.addedNodes ?? [];
		const addedEdges = patch.addedEdges ?? [];
		if (addedNodes.length === 0 && addedEdges.length === 0) return;
		const nodeById = new Map(this.data.nodes.map((node) => [node.id, node]));
		for (const node of addedNodes) nodeById.set(node.id, node);
		const edgeEndpointNodes = addedEdges.flatMap((edge) => {
			const source = nodeById.get(edge.source);
			const target = nodeById.get(edge.target);
			return source && target ? [source, target] : [];
		});
		const patchNodes = [...addedNodes, ...edgeEndpointNodes].filter(
			(node, index, all) => all.findIndex((candidate) => candidate.id === node.id) === index,
		);
		const compiled = compileGraph({ nodes: patchNodes, edges: addedEdges }, this.visuals);
		const nodeVisuals = new Map(patchNodes.map((node, index) => [node.id, compiled.nodeVisuals[index]]));
		const nextNodes = [...this.data.nodes, ...addedNodes.map((node) => ({ ...node, ...nodeVisuals.get(node.id) }))];
		const nextNodeIndices = new Map(this.nodeIndices);
		for (const [index, node] of nextNodes.entries()) nextNodeIndices.set(node.id, index);
		const nextEdges = [
			...this.data.edges,
			...addedEdges.map((edge, index) => ({ ...edge, ...compiled.edgeVisuals[index] })),
		];
		const nextEdgeIndices = new Uint32Array(nextEdges.length * 2);
		nextEdgeIndices.set(this.edgeNodeIndices);
		const nextEdgePositions = new Float32Array(nextEdges.length * 6);
		nextEdgePositions.set(this.canonicalEdgePositions);
		const nextEdgeColors = new Float32Array(nextEdges.length * 6);
		nextEdgeColors.set(this.canonicalEdgeColors);
		const nextIncidentEdges = this.incidentEdgeIndices.map((indices) => [...indices]);
		for (const [index, edge] of nextEdges.entries()) {
			const source = nextNodeIndices.get(edge.source);
			const target = nextNodeIndices.get(edge.target);
			if (source === undefined || target === undefined) continue;
			nextEdgeIndices[index * 2] = source;
			nextEdgeIndices[index * 2 + 1] = target;
			if (!nextIncidentEdges[source]) nextIncidentEdges[source] = [];
			if (!nextIncidentEdges[target]) nextIncidentEdges[target] = [];
			if (index >= this.data.edges.length) {
				nextIncidentEdges[source]?.push(index);
				nextIncidentEdges[target]?.push(index);
				const sourceNode = nextNodes[source];
				const targetNode = nextNodes[target];
				if (sourceNode && targetNode) {
					nextEdgePositions.set(
						[
							sourceNode.position.x,
							sourceNode.position.y,
							sourceNode.position.z ?? 0,
							targetNode.position.x,
							targetNode.position.y,
							targetNode.position.z ?? 0,
						],
						index * 6,
					);
				}
				const color = new Color(compiled.edgeVisuals[index - this.data.edges.length]?.color ?? this.theme.edge);
				color.toArray(nextEdgeColors, index * 6);
				color.toArray(nextEdgeColors, index * 6 + 3);
			}
		}
		this.data = { nodes: nextNodes, edges: nextEdges };
		this.nodeIds = nextNodes.map((node) => node.id);
		this.nodeIndices = nextNodeIndices;
		this.edgeNodeIndices = nextEdgeIndices;
		this.canonicalEdgePositions = nextEdgePositions;
		this.canonicalEdgeColors = nextEdgeColors;
		this.incidentEdgeIndices = nextIncidentEdges;
		for (const node of addedNodes) {
			const index = nextNodeIndices.get(node.id);
			const nextNode = index === undefined ? undefined : this.data.nodes[index];
			if (index !== undefined && nextNode) this.spatialGrid2d.set(index, nextNode);
		}
		for (const [id, presentation] of compiled.nodePresentations) this.nodePresentations.set(id, presentation);
		for (const [id, presentation] of compiled.edgePresentations) this.edgePresentations.set(id, presentation);
		this.materializeViewport();
		this.requestRender();
	}

	private replaceData(data: GraphraumData<NodeAttributes, EdgeAttributes>, fitView: boolean) {
		const compiled = compileGraph(data, this.visuals);
		this.disposeGraphObjects();
		this.data = {
			edges: data.edges.map((edge, index) => ({ ...edge, ...compiled.edgeVisuals[index] })),
			nodes: data.nodes.map((node, index) => ({
				...node,
				...compiled.nodeVisuals[index],
				position: { ...node.position },
			})),
		};
		this.nodeIds = compiled.nodeIds;
		this.nodeIndices = new Map(compiled.nodeIndices);
		this.edgeNodeIndices = compiled.edgeNodeIndices;
		this.canonicalEdgePositions = compiled.edgePositions;
		this.canonicalEdgeColors = new Float32Array(data.edges.length * 6);
		for (const [index, visual] of compiled.edgeVisuals.entries()) {
			const color = new Color(visual.color ?? this.theme.edge);
			color.toArray(this.canonicalEdgeColors, index * 6);
			color.toArray(this.canonicalEdgeColors, index * 6 + 3);
		}
		this.incidentEdgeIndices = compiled.incidentEdgeIndices;
		this.nodePresentations = new Map(compiled.nodePresentations);
		this.edgePresentations = new Map(compiled.edgePresentations);
		this.spatialGrid2d = new SpatialGrid2D();
		for (const [index, node] of this.data.nodes.entries()) this.spatialGrid2d.set(index, node);

		this.nodeCapacity = Math.min(this.maxVisibleNodes, nextCapacity(data.nodes.length));
		this.edgeCapacity = Math.min(this.maxVisibleEdges, nextCapacity(data.edges.length));
		const nodeCapacity = this.nodeCapacity;
		const nodeGeometry = createNodeGeometry(nodeCapacity);
		const nodeMaterial = createNodeMaterial(this.mode === "3d");
		const nodeMesh = new InstancedMesh(nodeGeometry, nodeMaterial, nodeCapacity);
		nodeMesh.renderOrder = this.mode === "2d" ? 1 : 0;
		this.nodeMesh = nodeMesh;
		this.scene.add(nodeMesh);

		const nodePickMesh = new InstancedMesh(new SphereGeometry(1, 8, 6), new MeshBasicMaterial(), nodeCapacity);
		this.nodePickMesh = nodePickMesh;

		const edgeGeometry = new BufferGeometry();
		const edgePositions = new Float32Array(this.edgeCapacity * 6);
		edgePositions.set(compiled.edgePositions);
		const edgeColors = new Float32Array(this.edgeCapacity * 6);
		edgeColors.set(this.canonicalEdgeColors);
		edgeGeometry.setAttribute("position", new BufferAttribute(edgePositions, 3));
		edgeGeometry.setAttribute("color", new BufferAttribute(edgeColors, 3));
		const edgeLines = new LineSegments(
			edgeGeometry,
			new LineBasicMaterial({ color: "#ffffff", opacity: 0.55, transparent: true, vertexColors: true }),
		);
		this.edgeLines = edgeLines;
		this.scene.add(edgeLines);

		if (fitView) this.fitView();
		else this.requestRender();
	}

	updateNodes(updates: readonly GraphraumNodeUpdate[]) {
		if (updates.length === 0) return;
		const objects = this.getGraphObjects("update nodes");
		const prepared = prepareNodeUpdates(this.data.nodes, this.nodeIndices, updates);
		this.applyPreparedNodeUpdates(prepared, objects);
	}

	/** Applies a transferable XYZ layout batch. Call repeatedly as a worker produces progressive positions. */
	applyLayout(layout: GraphraumLayoutPositions) {
		const prepared = prepareLayoutPositions(this.data.nodes, this.nodeIndices, layout);
		if (prepared.length === 0) return;
		const objects = this.getGraphObjects("apply a layout");
		this.applyPreparedNodeUpdates(prepared, objects);
	}

	private getGraphObjects(action: string): GraphraumGraphObjects {
		if (!this.nodeMesh || !this.nodePickMesh || !this.edgeLines) {
			throw new Error(`Cannot ${action} before graph data is set`);
		}
		return { edgeLines: this.edgeLines, nodeMesh: this.nodeMesh, nodePickMesh: this.nodePickMesh };
	}

	private applyPreparedNodeUpdates(
		prepared: readonly PreparedNodeUpdate<NodeAttributes>[],
		{ edgeLines, nodeMesh, nodePickMesh }: GraphraumGraphObjects,
	) {
		const nodes = [...this.data.nodes];
		const matrix = new Matrix4();
		const edgePosition = edgeLines.geometry.getAttribute("position") as BufferAttribute;
		const nodeShape = nodeMesh.geometry.getAttribute("instanceShape") as InstancedBufferAttribute;
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
					nodeMesh.setMatrixAt(nodeSlot, matrix);
					nodeMesh.instanceMatrix.addUpdateRange(nodeSlot * 16, 16);
					const pickSize = size * Math.SQRT2;
					matrix.makeScale(pickSize, pickSize, pickSize);
					matrix.setPosition(update.next.position.x, update.next.position.y, update.next.position.z ?? 0);
					nodePickMesh.setMatrixAt(nodeSlot, matrix);
					nodePickMesh.instanceMatrix.addUpdateRange(nodeSlot * 16, 16);
				}
			}
			if (update.colorChanged && nodeSlot !== undefined) {
				nodeMesh.setColorAt(nodeSlot, this.getNodeColor(update.next));
				nodeMesh.instanceColor?.addUpdateRange(nodeSlot * 3, 3);
			}
			if (update.shapeChanged && nodeSlot !== undefined) {
				setNodeShapeAt(nodeShape, nodeSlot, update.next.shape);
				nodeShape.addUpdateRange(nodeSlot, 1);
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
		if (this.densityLodActive && prepared.some((update) => update.positionChanged || update.sizeChanged)) {
			visibilityChanged = true;
		}

		this.data = { ...this.data, nodes };
		if (visibilityChanged) {
			this.materializeViewport();
			this.requestRender();
			return;
		}
		if (prepared.some((update) => update.positionChanged || update.sizeChanged)) {
			nodeMesh.instanceMatrix.needsUpdate = true;
			nodePickMesh.instanceMatrix.needsUpdate = true;
		}
		if (prepared.some((update) => update.colorChanged) && nodeMesh.instanceColor) {
			nodeMesh.instanceColor.needsUpdate = true;
		}
		if (prepared.some((update) => update.shapeChanged)) nodeShape.needsUpdate = true;
		if (prepared.some((update) => update.positionChanged)) edgePosition.needsUpdate = true;
		this.requestRender();
	}

	setSelection(nodeIds: Iterable<string>) {
		this.setNodeState("selected", nodeIds);
	}

	/** Applies an application-owned visual state without changing source graph data. */
	setNodeState(state: GraphraumNodeState, nodeIds: Iterable<string>) {
		const nextSelection = new Set(nodeIds);
		const currentSelection = this.getNodeStateIds(state);
		const changedNodeIds = new Set(
			[...currentSelection, ...nextSelection].filter(
				(nodeId) => currentSelection.has(nodeId) !== nextSelection.has(nodeId),
			),
		);
		this.setNodeStateIds(state, nextSelection);
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
		if (this.nodeMesh && !Array.isArray(this.nodeMesh.material)) {
			this.nodeMesh.material.depthTest = mode === "3d";
			this.nodeMesh.material.depthWrite = mode === "3d";
			this.nodeMesh.material.needsUpdate = true;
			this.nodeMesh.renderOrder = mode === "2d" ? 1 : 0;
		}
		this.fitView();
	}

	getMode() {
		return this.mode;
	}

	getNodePresentation(nodeId: string): CompiledGraphraumPresentation | null {
		return this.nodePresentations.get(nodeId) ?? null;
	}

	/** Returns canvas-relative screen coordinates for a node, or null when the node does not exist. */
	getNodeScreenPosition(nodeId: string): GraphraumScreenPosition | null {
		const index = this.nodeIndices.get(nodeId);
		const node = index === undefined ? undefined : this.data.nodes[index];
		if (!node) return null;
		const projected = new Vector3(node.position.x, node.position.y, node.position.z ?? 0).project(this.camera);
		const width = this.renderer.domElement.clientWidth;
		const height = this.renderer.domElement.clientHeight;
		return {
			visible:
				projected.x >= -1 &&
				projected.x <= 1 &&
				projected.y >= -1 &&
				projected.y <= 1 &&
				projected.z >= -1 &&
				projected.z <= 1,
			x: ((projected.x + 1) * width) / 2,
			y: ((1 - projected.y) * height) / 2,
		};
	}

	/** Converts client coordinates to graph world coordinates on the z=0 plane. */
	screenToWorld(clientX: number, clientY: number): { x: number; y: number; z: number } | null {
		const bounds = this.renderer.domElement.getBoundingClientRect();
		if (bounds.width === 0 || bounds.height === 0) return null;
		const worldX = ((clientX - bounds.left) / bounds.width) * 2 - 1;
		const worldY = -((clientY - bounds.top) / bounds.height) * 2 + 1;
		this.pointer.set(worldX, worldY);
		if (this.camera instanceof OrthographicCamera) {
			const world = new Vector3(this.pointer.x, this.pointer.y, 0).unproject(this.camera);
			return { x: world.x, y: world.y, z: world.z };
		}
		this.raycaster.setFromCamera(this.pointer, this.camera);
		const plane = new Plane(new Vector3(0, 0, 1), 0);
		const world = this.raycaster.ray.intersectPlane(plane, new Vector3());
		if (!world) return null;
		return { x: world.x, y: world.y, z: world.z };
	}

	/** Creates a bounded DOM layer for styled labels and a focused-node toolbar. */
	createOverlay(options: GraphraumOverlayOptions = {}) {
		return new GraphraumOverlay(this, this.container, options);
	}

	/** Subscribes to camera and viewport changes. Returns an unsubscribe function. */
	onViewChange(listener: () => void) {
		this.viewListeners.add(listener);
		listener();
		return () => this.viewListeners.delete(listener);
	}

	getEdgePresentation(edgeId: string): CompiledGraphraumPresentation | null {
		return this.edgePresentations.get(edgeId) ?? null;
	}

	getDiagnostics(): GraphraumDiagnostics {
		return {
			aggregatedNodeClusters: this.densityLodActive ? this.visibleNodeCount : 0,
			cpuFrameMilliseconds: this.cpuFrameMilliseconds,
			gpuFrameMilliseconds: this.gpuFrameMilliseconds,
			gpuDrawCalls: this.renderer.info.render.calls,
			gpuGeometries: this.renderer.info.memory.geometries,
			gpuTextures: this.renderer.info.memory.textures,
			lodLevel: this.densityLodActive
				? "density"
				: this.visibleEdgeCandidateCount > this.visibleEdgeCount
					? "overview"
					: "detail",
			pickingStrategy: this.mode === "2d" ? "spatial-grid-2d" : "raycaster-3d",
			totalEdges: this.data.edges.length,
			totalNodes: this.data.nodes.length,
			visibleEdgeCandidates: this.visibleEdgeCandidateCount,
			visibleEdgeMarkers: 0,
			visibleEdgeSegments: this.visibleEdgeCount,
			visibleEdges: this.visibleEdgeCount,
			visibleNodes: this.visibleNodeCount,
			visibleNodeCandidates: this.visibleNodeCandidateCount,
		};
	}

	pick(clientX: number, clientY: number): string | null {
		if (!this.nodeMesh || !this.nodePickMesh) return null;
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
		const checkedInstances = new Set<number>();
		for (const hit of this.raycaster.intersectObject(this.nodePickMesh, false)) {
			if (hit.instanceId === undefined || checkedInstances.has(hit.instanceId)) continue;
			checkedInstances.add(hit.instanceId);
			const nodeIndex = this.visibleNodeIndices[hit.instanceId];
			if (nodeIndex === undefined) continue;
			const node = this.data.nodes[nodeIndex];
			if (!node) continue;
			const radius = node.size ?? 4;
			this.pickCenter.set(node.position.x, node.position.y, node.position.z ?? 0).project(this.camera);
			this.pickRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(radius);
			this.pickRight.set(
				this.pickRight.x + node.position.x,
				this.pickRight.y + node.position.y,
				this.pickRight.z + (node.position.z ?? 0),
			);
			this.pickRight.project(this.camera);
			const radiusNdc = Math.abs(this.pickRight.x - this.pickCenter.x);
			if (radiusNdc === 0) continue;
			const offsetX = (this.pointer.x - this.pickCenter.x) / radiusNdc;
			const offsetY = (this.pointer.y - this.pickCenter.y) / (radiusNdc * (bounds.width / bounds.height));
			if (containsNodePoint(node.shape, offsetX, offsetY)) return this.nodeIds[nodeIndex] ?? null;
		}
		return null;
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
		if (this.gpuTimer) {
			for (const query of this.gpuTimer.pending) this.gpuTimer.context.deleteQuery(query);
		}
		this.disposeGraphObjects();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	private readonly requestRender = () => {
		if (this.frameRequest !== null) return;
		this.frameRequest = requestAnimationFrame(() => {
			this.frameRequest = null;
			this.readGpuTimers();
			const timer = this.gpuTimer;
			const query = timer?.context.createQuery() ?? null;
			if (timer && query) timer.context.beginQuery(timer.extension.TIME_ELAPSED_EXT, query);
			const startedAt = performance.now();
			this.renderer.render(this.scene, this.camera);
			this.cpuFrameMilliseconds = performance.now() - startedAt;
			if (timer && query) {
				timer.context.endQuery(timer.extension.TIME_ELAPSED_EXT);
				timer.pending.push(query);
			}
			for (const listener of this.viewListeners) listener();
		});
	};

	private readGpuTimers() {
		const timer = this.gpuTimer;
		if (!timer) return;
		while (timer.pending.length > 0) {
			const query = timer.pending[0];
			if (!query || !timer.context.getQueryParameter(query, timer.context.QUERY_RESULT_AVAILABLE)) return;
			timer.pending.shift();
			if (!timer.context.getParameter(timer.extension.GPU_DISJOINT_EXT)) {
				this.gpuFrameMilliseconds = timer.context.getQueryParameter(query, timer.context.QUERY_RESULT) / 1_000_000;
			}
			timer.context.deleteQuery(query);
		}
	}

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
		if (this.mode === "2d") {
			controls.minZoom = 0.01;
			controls.mouseButtons.LEFT = MOUSE.PAN;
		}
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
			this.nodeMesh.setColorAt(slot, this.getNodeColor(node));
		}
		if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
	}

	private getNodeStateIds(state: GraphraumNodeState) {
		switch (state) {
			case "dimmed":
				return this.dimmedNodeIds;
			case "focused":
				return this.focusedNodeIds;
			case "hovered":
				return this.hoveredNodeIds;
			case "selected":
				return this.selectedNodeIds;
		}
	}

	private setNodeStateIds(state: GraphraumNodeState, nodeIds: Set<string>) {
		switch (state) {
			case "dimmed":
				this.dimmedNodeIds = nodeIds;
				return;
			case "focused":
				this.focusedNodeIds = nodeIds;
				return;
			case "hovered":
				this.hoveredNodeIds = nodeIds;
				return;
			case "selected":
				this.selectedNodeIds = nodeIds;
		}
	}

	private getNodeColor(node: GraphraumData<NodeAttributes, EdgeAttributes>["nodes"][number]) {
		if (this.focusedNodeIds.has(node.id)) return new Color(this.theme.focusedNode);
		if (this.selectedNodeIds.has(node.id)) return new Color(this.theme.selectedNode);
		if (this.hoveredNodeIds.has(node.id)) return new Color(this.theme.hoveredNode);
		if (this.dimmedNodeIds.has(node.id)) return new Color(this.theme.dimmedNode);
		return new Color(node.color ?? this.theme.node);
	}

	private getViewportBounds2d(): Bounds2D | null {
		if (!(this.camera instanceof OrthographicCamera) || !this.viewportCulling) return null;
		const bottomLeft = new Vector3(-1, -1, 0).unproject(this.camera);
		const topRight = new Vector3(1, 1, 0).unproject(this.camera);
		return { bottom: bottomLeft.y, left: bottomLeft.x, right: topRight.x, top: topRight.y };
	}

	private isNodeVisible2d(
		node: GraphraumData<NodeAttributes, EdgeAttributes>["nodes"][number],
		bounds: Bounds2D | null,
	) {
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
		if (!this.nodeMesh || !this.nodePickMesh || !this.edgeLines) return;
		const bounds = this.getViewportBounds2d();
		const visibleNodeCandidates = bounds
			? this.spatialGrid2d.queryBounds(bounds, this.viewportOverscan)
			: this.data.nodes.map((_, index) => index);
		this.densityLodActive = shouldUseDensityLod(
			visibleNodeCandidates.length,
			this.maxVisibleNodes,
			this.densityLodActive,
		);
		const materializedNodes = this.materializeNodes(visibleNodeCandidates, bounds);
		const visibleNodeIndices = materializedNodes.map(({ index }) => index);
		const edgeCandidates = bounds
			? collectIncidentEdges(visibleNodeIndices, this.incidentEdgeIndices)
			: this.data.edges.map((_, index) => index);
		const visibleEdgeIndices = applyEdgeBudget(edgeCandidates, this.maxVisibleEdges);
		const matrix = new Matrix4();
		this.visibleNodeSlots = new Map();
		this.visibleNodeIndices = visibleNodeIndices;
		this.nodeMesh.instanceMatrix.clearUpdateRanges();
		this.nodePickMesh.instanceMatrix.clearUpdateRanges();
		this.nodeMesh.instanceColor?.clearUpdateRanges();
		const nodeShape = this.nodeMesh.geometry.getAttribute("instanceShape") as InstancedBufferAttribute;
		nodeShape.clearUpdateRanges();
		for (const [slot, materialized] of materializedNodes.entries()) {
			const nodeIndex = materialized.index;
			const node = this.data.nodes[nodeIndex];
			if (!node) continue;
			this.visibleNodeSlots.set(nodeIndex, slot);
			const size = materialized.size;
			matrix.makeScale(size, size, size);
			matrix.setPosition(materialized.x, materialized.y, materialized.z);
			this.nodeMesh.setMatrixAt(slot, matrix);
			const pickSize = size * Math.SQRT2;
			matrix.makeScale(pickSize, pickSize, pickSize);
			matrix.setPosition(materialized.x, materialized.y, materialized.z);
			this.nodePickMesh.setMatrixAt(slot, matrix);
			this.nodeMesh.setColorAt(slot, this.getNodeColor(node));
			setNodeShapeAt(nodeShape, slot, node.shape);
		}
		this.nodeMesh.count = materializedNodes.length;
		this.nodePickMesh.count = materializedNodes.length;
		this.nodeMesh.instanceMatrix.addUpdateRange(0, materializedNodes.length * 16);
		this.nodeMesh.instanceMatrix.needsUpdate = true;
		this.nodePickMesh.instanceMatrix.addUpdateRange(0, materializedNodes.length * 16);
		this.nodePickMesh.instanceMatrix.needsUpdate = true;
		if (this.nodeMesh.instanceColor) {
			this.nodeMesh.instanceColor.addUpdateRange(0, materializedNodes.length * 3);
			this.nodeMesh.instanceColor.needsUpdate = true;
		}
		nodeShape.addUpdateRange(0, materializedNodes.length);
		nodeShape.needsUpdate = true;

		const edgePosition = this.edgeLines.geometry.getAttribute("position") as BufferAttribute;
		const renderedEdgePositions = edgePosition.array as Float32Array;
		const edgeColor = this.edgeLines.geometry.getAttribute("color") as BufferAttribute;
		const renderedEdgeColors = edgeColor.array as Float32Array;
		edgePosition.clearUpdateRanges();
		edgeColor.clearUpdateRanges();
		this.visibleEdgeSlots = new Map();
		for (const [slot, edgeIndex] of visibleEdgeIndices.entries()) {
			this.visibleEdgeSlots.set(edgeIndex, slot);
			renderedEdgePositions.set(this.canonicalEdgePositions.subarray(edgeIndex * 6, edgeIndex * 6 + 6), slot * 6);
			renderedEdgeColors.set(this.canonicalEdgeColors.subarray(edgeIndex * 6, edgeIndex * 6 + 6), slot * 6);
		}
		this.edgeLines.geometry.setDrawRange(0, visibleEdgeIndices.length * 2);
		edgePosition.addUpdateRange(0, visibleEdgeIndices.length * 6);
		edgePosition.needsUpdate = true;
		edgeColor.addUpdateRange(0, visibleEdgeIndices.length * 6);
		edgeColor.needsUpdate = true;

		this.visibleNodeCandidateCount = visibleNodeCandidates.length;
		this.visibleNodeCount = materializedNodes.length;
		this.visibleEdgeCandidateCount = edgeCandidates.length;
		this.visibleEdgeCount = visibleEdgeIndices.length;
	}

	private materializeNodes(indices: readonly number[], bounds: Bounds2D | null): readonly MaterializedNode[] {
		if (!this.densityLodActive || !bounds) {
			return indices.slice(0, this.maxVisibleNodes).flatMap((index) => {
				const node = this.data.nodes[index];
				return node
					? [{ index, size: node.size ?? 4, x: node.position.x, y: node.position.y, z: node.position.z ?? 0 }]
					: [];
			});
		}
		const aspect = Math.max(this.container.clientWidth, 1) / Math.max(this.container.clientHeight, 1);
		const columns = Math.max(1, Math.floor(Math.sqrt(this.maxVisibleNodes * aspect)));
		const rows = Math.max(1, Math.floor(this.maxVisibleNodes / columns));
		const cellWidth = Math.max((bounds.right - bounds.left) / columns, Number.EPSILON);
		const cellHeight = Math.max((bounds.top - bounds.bottom) / rows, Number.EPSILON);
		const clusters = new Map<string, MaterializedNode & { count: number }>();
		for (const index of indices) {
			const node = this.data.nodes[index];
			if (!node) continue;
			const x = Math.min(columns - 1, Math.max(0, Math.floor((node.position.x - bounds.left) / cellWidth)));
			const y = Math.min(rows - 1, Math.max(0, Math.floor((node.position.y - bounds.bottom) / cellHeight)));
			const key = `${x}:${y}`;
			const cluster = clusters.get(key);
			if (!cluster) {
				clusters.set(key, {
					count: 1,
					index,
					size: node.size ?? 4,
					x: node.position.x,
					y: node.position.y,
					z: node.position.z ?? 0,
				});
				continue;
			}
			cluster.count += 1;
			cluster.x += (node.position.x - cluster.x) / cluster.count;
			cluster.y += (node.position.y - cluster.y) / cluster.count;
			cluster.z += ((node.position.z ?? 0) - cluster.z) / cluster.count;
			cluster.size = Math.min(Math.max(cluster.size, node.size ?? 4) + 0.25, 16);
		}
		return [...clusters.values()].slice(0, this.maxVisibleNodes);
	}

	private disposeGraphObjects() {
		if (this.nodeMesh) {
			this.scene.remove(this.nodeMesh);
			this.nodeMesh.geometry.dispose();
			disposeMaterial(this.nodeMesh.material);
			this.nodeMesh = null;
		}
		if (this.nodePickMesh) {
			this.nodePickMesh.geometry.dispose();
			disposeMaterial(this.nodePickMesh.material);
			this.nodePickMesh = null;
		}
		if (this.edgeLines) {
			this.scene.remove(this.edgeLines);
			this.edgeLines.geometry.dispose();
			disposeMaterial(this.edgeLines.material);
			this.edgeLines = null;
		}
	}
}

function nextCapacity(length: number): number {
	let capacity = 1;
	while (capacity < length) capacity *= 2;
	return capacity;
}
