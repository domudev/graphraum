export type GraphraumColor = number | string;

export type GraphraumMode = "2d" | "3d";

export interface GraphraumPosition {
	x: number;
	y: number;
	z?: number;
}

export interface GraphraumNode {
	id: string;
	position: GraphraumPosition;
	color?: GraphraumColor;
	size?: number;
}

export interface GraphraumNodeUpdate {
	color?: GraphraumColor | undefined;
	id: string;
	position?: GraphraumPosition;
	size?: number | undefined;
}

export interface GraphraumEdge {
	id: string;
	source: string;
	target: string;
}

export interface GraphraumData {
	nodes: readonly GraphraumNode[];
	edges: readonly GraphraumEdge[];
}

export interface GraphraumTheme {
	background: GraphraumColor;
	edge: GraphraumColor;
	node: GraphraumColor;
	selectedNode: GraphraumColor;
}

export interface GraphraumOptions {
	antialias?: boolean;
	maxPixelRatio?: number;
	mode?: GraphraumMode;
	theme?: Partial<GraphraumTheme>;
}

export interface GraphraumDiagnostics {
	gpuDrawCalls: number;
}
