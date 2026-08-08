export interface ResolveNodeAxesInput {
	defaultSize?: number;
	height?: number;
	nodeId?: string;
	size?: number;
	width?: number;
}

export interface NodeAxes {
	height: number;
	width: number;
}

function assertPositiveFinite(value: number, axis: "height" | "width", nodeId: string | undefined): void {
	if (!Number.isFinite(value) || value <= 0) {
		const preamble = nodeId === undefined ? "" : `Node "${nodeId}" `;
		throw new Error(`${preamble}${axis} must be a positive finite number`);
	}
}

export function resolveNodeAxes(input: ResolveNodeAxesInput): NodeAxes {
	const { defaultSize = 4, height, nodeId, size, width } = input;
	const resolvedWidth = width ?? size ?? defaultSize;
	const resolvedHeight = height ?? size ?? defaultSize;

	assertPositiveFinite(resolvedWidth, "width", nodeId);
	assertPositiveFinite(resolvedHeight, "height", nodeId);

	return { width: resolvedWidth, height: resolvedHeight };
}
