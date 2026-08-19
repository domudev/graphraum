export type GraphraumColor = number | string;

export type GraphraumMode = "2d" | "3d";

export type GraphraumNodeState = "dimmed" | "focused" | "hovered" | "selected";

export type GraphraumNodeShape = "circle" | "diamond" | "hexagon" | "pill" | "rounded" | "square" | "triangle";

export interface GraphraumPosition {
	x: number;
	y: number;
	z?: number;
}

type GraphraumAttributes<Attributes> = [Attributes] extends [undefined]
	? { attributes?: never }
	: { attributes: Attributes };

export interface GraphraumNodeGeometry {
	id: string;
	position: GraphraumPosition;
	color?: GraphraumColor;
	height?: number;
	shape?: GraphraumNodeShape;
	size?: number;
	strokeColor?: GraphraumColor;
	strokeWidth?: number;
	width?: number;
}

export type GraphraumNode<NodeAttributes = undefined> = GraphraumNodeGeometry & GraphraumAttributes<NodeAttributes>;

export interface GraphraumNodeUpdate {
	color?: GraphraumColor | undefined;
	height?: number | undefined;
	id: string;
	position?: GraphraumPosition;
	shape?: GraphraumNodeShape | undefined;
	size?: number | undefined;
	strokeColor?: GraphraumColor | undefined;
	strokeWidth?: number | undefined;
	width?: number | undefined;
}

/** A transferable XYZ position batch in the same order as `nodeIds`. */
export interface GraphraumLayoutPositions {
	nodeIds: readonly string[];
	positions: Float32Array;
}

export type GraphraumEdgeStyle = "solid" | "dashed" | "dotted";
export type GraphraumEdgeMarker = "none" | "triangle";
export type GraphraumEdgeMarkerEnd = "target" | "source" | "both";
export type GraphraumEdgePath = "straight" | "quadratic" | "cubic";

export type GraphraumEdge<EdgeAttributes = undefined> = {
	color?: GraphraumColor;
	width?: number;
	opacity?: number;
	style?: GraphraumEdgeStyle;
	marker?: GraphraumEdgeMarker;
	markerSize?: number;
	markerEnd?: GraphraumEdgeMarkerEnd;
	path?: GraphraumEdgePath;
	controlPoints?: readonly GraphraumPosition[];
	id: string;
	source: string;
	target: string;
} & GraphraumAttributes<EdgeAttributes>;

export interface GraphraumData<NodeAttributes = undefined, EdgeAttributes = undefined> {
	nodes: readonly GraphraumNode<NodeAttributes>[];
	edges: readonly GraphraumEdge<EdgeAttributes>[];
}

export interface GraphraumDataPatch<NodeAttributes = undefined, EdgeAttributes = undefined> {
	addedNodes?: readonly GraphraumNode<NodeAttributes>[];
	addedEdges?: readonly GraphraumEdge<EdgeAttributes>[];
	removedNodeIds?: readonly string[];
	removedEdgeIds?: readonly string[];
}

export interface GraphraumNodeVisual {
	color?: GraphraumColor;
	height?: number;
	shape?: GraphraumNodeShape;
	size?: number;
	strokeColor?: GraphraumColor;
	strokeWidth?: number;
	width?: number;
}

export interface GraphraumEdgeVisual {
	color?: GraphraumColor;
	width?: number;
	opacity?: number;
	style?: GraphraumEdgeStyle;
	marker?: GraphraumEdgeMarker;
	markerSize?: number;
	markerEnd?: GraphraumEdgeMarkerEnd;
	path?: GraphraumEdgePath;
	controlPoints?: readonly GraphraumPosition[];
}

export type GraphraumPropertyValue = boolean | null | number | string;

export interface GraphraumPresentationProperty {
	id: string;
	label: string;
	value: GraphraumPropertyValue;
}

export interface GraphraumPresentationAction {
	disabled?: boolean;
	id: string;
	label: string;
}

export interface GraphraumPresentation {
	actions?: readonly GraphraumPresentationAction[];
	properties?: readonly GraphraumPresentationProperty[];
	subtitle?: string;
	title: string;
}

export interface CompiledGraphraumPresentation extends GraphraumPresentation {
	actions: readonly Readonly<GraphraumPresentationAction>[];
	properties: readonly Readonly<GraphraumPresentationProperty>[];
}

export interface GraphraumScreenPosition {
	visible: boolean;
	x: number;
	y: number;
}

export interface GraphraumOverlayNode {
	id: string;
	presentation: CompiledGraphraumPresentation | null;
}

export interface GraphraumLabelCandidate {
	id: string;
	importance: number;
	visible: boolean;
}

export interface GraphraumOverlayOptions {
	/**
	 * Label refresh policy. `manual` only shows ids from `setLabels()`. `auto` budgets by
	 * importance on view change. `focus` budgets selected ∪ hovered ∪ 1-hop neighbors first.
	 * When omitted, `autoLabels: true` maps to `auto` for compatibility; otherwise `manual`.
	 */
	labelPolicy?: "manual" | "auto" | "focus";
	/**
	 * @deprecated Prefer `labelPolicy: "auto"`. When `labelPolicy` is omitted, `true` enables `auto`.
	 */
	autoLabels?: boolean;
	/**
	 * When set with `renderToolbar`, keeps the toolbar pinned to the selected or hovered node.
	 * Default `false` — host calls `setToolbar` manually.
	 */
	autoToolbar?: false | "selected" | "hovered";
	overlayClassName?: string;
	maxLabels?: number;
	labelClassName?: string;
	toolbarClassName?: string;
	renderLabel?: (node: GraphraumOverlayNode) => HTMLElement | null;
	renderToolbar?: (node: GraphraumOverlayNode) => HTMLElement | null;
}

export interface GraphraumNodeEncoding {
	presentation?: GraphraumPresentation;
	visual?: GraphraumNodeVisual;
}

export interface GraphraumEdgeEncoding {
	presentation?: GraphraumPresentation;
	visual?: GraphraumEdgeVisual;
}

export interface GraphraumVisualMapper<NodeAttributes = undefined, EdgeAttributes = undefined> {
	edge?: (edge: Readonly<GraphraumEdge<EdgeAttributes>>) => GraphraumEdgeEncoding | undefined;
	node?: (node: Readonly<GraphraumNode<NodeAttributes>>) => GraphraumNodeEncoding | undefined;
}

export interface GraphraumTheme {
	background: GraphraumColor;
	dimmedNode: GraphraumColor;
	edge: GraphraumColor;
	edgeOpacity: number;
	edgeWidth: number;
	focusedNode: GraphraumColor;
	hoveredNode: GraphraumColor;
	node: GraphraumColor;
	nodeStroke: GraphraumColor;
	selectedEdge: GraphraumColor;
	selectedNode: GraphraumColor;
}

/** Discriminated pick result. Nodes win over edges when both intersect the pointer. */
export type GraphraumPickHit = { kind: "edge"; id: string } | { kind: "node"; id: string };

export interface GraphraumOptions<NodeAttributes = undefined, EdgeAttributes = undefined> {
	antialias?: boolean;
	maxVisibleEdges?: number;
	maxVisibleNodes?: number;
	maxPixelRatio?: number;
	mode?: GraphraumMode;
	theme?: Partial<GraphraumTheme>;
	viewportCulling?: boolean;
	viewportOverscan?: number;
	visuals?: GraphraumVisualMapper<NodeAttributes, EdgeAttributes>;
}

export interface GraphraumDiagnostics {
	aggregatedNodeClusters: number;
	cpuFrameMilliseconds: number;
	gpuFrameMilliseconds: number | null;
	gpuDrawCalls: number;
	gpuGeometries: number;
	gpuTextures: number;
	lodLevel: "density" | "detail" | "overview";
	pickingStrategy: "raycaster-3d" | "spatial-grid-2d";
	selectedEdges: number;
	selectedNodes: number;
	totalEdges: number;
	totalNodes: number;
	visibleEdgeCandidates: number;
	visibleEdgeMarkers: number;
	visibleEdgeSegments: number;
	visibleEdges: number;
	visibleNodes: number;
	visibleNodeCandidates: number;
}
