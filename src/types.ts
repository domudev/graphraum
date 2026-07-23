export type GraphraumColor = number | string;

export type GraphraumMode = "2d" | "3d";

export type GraphraumNodeShape = "circle" | "diamond" | "square";

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
	shape?: GraphraumNodeShape;
	size?: number;
}

export type GraphraumNode<NodeAttributes = undefined> = GraphraumNodeGeometry & GraphraumAttributes<NodeAttributes>;

export interface GraphraumNodeUpdate {
	color?: GraphraumColor | undefined;
	id: string;
	position?: GraphraumPosition;
	shape?: GraphraumNodeShape | undefined;
	size?: number | undefined;
}

export type GraphraumEdge<EdgeAttributes = undefined> = {
	color?: GraphraumColor;
	id: string;
	source: string;
	target: string;
} & GraphraumAttributes<EdgeAttributes>;

export interface GraphraumData<NodeAttributes = undefined, EdgeAttributes = undefined> {
	nodes: readonly GraphraumNode<NodeAttributes>[];
	edges: readonly GraphraumEdge<EdgeAttributes>[];
}

export interface GraphraumNodeVisual {
	color?: GraphraumColor;
	shape?: GraphraumNodeShape;
	size?: number;
}

export interface GraphraumEdgeVisual {
	color?: GraphraumColor;
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
	edge: GraphraumColor;
	node: GraphraumColor;
	selectedNode: GraphraumColor;
}

export interface GraphraumOptions<NodeAttributes = undefined, EdgeAttributes = undefined> {
	antialias?: boolean;
	maxVisibleEdges?: number;
	maxPixelRatio?: number;
	mode?: GraphraumMode;
	theme?: Partial<GraphraumTheme>;
	viewportCulling?: boolean;
	viewportOverscan?: number;
	visuals?: GraphraumVisualMapper<NodeAttributes, EdgeAttributes>;
}

export interface GraphraumDiagnostics {
	gpuDrawCalls: number;
	lodLevel: "detail" | "overview";
	pickingStrategy: "raycaster-3d" | "spatial-grid-2d";
	visibleEdgeCandidates: number;
	visibleEdges: number;
	visibleNodes: number;
}
