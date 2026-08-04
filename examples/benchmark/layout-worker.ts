import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

type LayoutName = "circle" | "force-custom" | "forceatlas2" | "grid";

type LayoutRequest = {
	batchSize: number;
	edges?: Uint32Array;
	layout: LayoutName;
	nodeCount: number;
	run: number;
};

type LayoutWorkerMessage = ({ type: "start" } & LayoutRequest) | { run: number; type: "next" };

type WorkerScope = {
	addEventListener(type: "message", listener: (event: MessageEvent<LayoutWorkerMessage>) => void): void;
	postMessage(message: unknown, transfer: Transferable[]): void;
};

const workerScope = self as unknown as WorkerScope;
let activeLayout: { nextStart: number; positions?: Float32Array; request: LayoutRequest } | undefined;

function forceAtlasPositions(request: LayoutRequest) {
	const graph = new Graph();
	const columns = Math.ceil(Math.sqrt(request.nodeCount));
	for (let index = 0; index < request.nodeCount; index += 1) {
		graph.addNode(String(index), { x: (index % columns) * 12, y: Math.floor(index / columns) * 12 });
	}
	const edges = request.edges ?? new Uint32Array();
	for (let index = 0; index < edges.length; index += 2) {
		const source = edges[index];
		const target = edges[index + 1];
		if (source !== undefined && target !== undefined && source !== target)
			graph.mergeEdge(String(source), String(target));
	}
	forceAtlas2.assign(graph, {
		iterations: Math.max(10, Math.min(100, Math.floor(1_000_000 / request.nodeCount))),
		settings: { barnesHutOptimize: true },
	});
	const positions = new Float32Array(request.nodeCount * 3);
	graph.forEachNode((id, attributes) => positions.set([attributes.x, attributes.y, 0], Number(id) * 3));
	return positions;
}

function customForcePositions(request: LayoutRequest) {
	const positions = positionsFor({ ...request, layout: "circle" }, 0, request.nodeCount);
	const edges = request.edges ?? new Uint32Array();
	const iterations = Math.max(8, Math.min(40, Math.floor(400_000 / request.nodeCount)));
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		let centerX = 0;
		let centerY = 0;
		for (let index = 0; index < request.nodeCount; index += 1) {
			centerX += positions[index * 3] ?? 0;
			centerY += positions[index * 3 + 1] ?? 0;
		}
		centerX /= request.nodeCount;
		centerY /= request.nodeCount;
		for (let index = 0; index < request.nodeCount; index += 1) {
			const offset = index * 3;
			const dx = (positions[offset] ?? 0) - centerX;
			const dy = (positions[offset + 1] ?? 0) - centerY;
			const distance = Math.max(Math.hypot(dx, dy), 1);
			positions[offset] = (positions[offset] ?? 0) + dx / distance;
			positions[offset + 1] = (positions[offset + 1] ?? 0) + dy / distance;
		}
		for (let index = 0; index < edges.length; index += 2) {
			const source = (edges[index] ?? 0) * 3;
			const target = (edges[index + 1] ?? 0) * 3;
			const dx = (positions[target] ?? 0) - (positions[source] ?? 0);
			const dy = (positions[target + 1] ?? 0) - (positions[source + 1] ?? 0);
			const distance = Math.max(Math.hypot(dx, dy), 0.01);
			const force = (distance - 24) * 0.002;
			positions[source] = (positions[source] ?? 0) + dx * force;
			positions[source + 1] = (positions[source + 1] ?? 0) + dy * force;
			positions[target] = (positions[target] ?? 0) - dx * force;
			positions[target + 1] = (positions[target + 1] ?? 0) - dy * force;
		}
	}
	return positions;
}

function positionsFor(request: LayoutRequest, start: number, end: number) {
	const positions = new Float32Array((end - start) * 3);
	const columns = Math.ceil(Math.sqrt(request.nodeCount));
	const radius = Math.max(Math.sqrt(request.nodeCount) * 6, 24);
	for (let index = start; index < end; index += 1) {
		const offset = (index - start) * 3;
		if (request.layout === "circle") {
			const angle = (index / request.nodeCount) * Math.PI * 2;
			positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], offset);
			continue;
		}
		positions.set([(index % columns) * 12, Math.floor(index / columns) * 12, ((index * 17) % 101) - 50], offset);
	}
	return positions;
}

function postNextBatch(run: number) {
	if (!activeLayout || activeLayout.request.run !== run) return;
	if (activeLayout.nextStart === activeLayout.request.nodeCount) {
		activeLayout = undefined;
		workerScope.postMessage({ run, type: "complete" }, []);
		return;
	}
	const start = activeLayout.nextStart;
	const end = Math.min(start + activeLayout.request.batchSize, activeLayout.request.nodeCount);
	const positions = activeLayout.positions
		? activeLayout.positions.slice(start * 3, end * 3)
		: positionsFor(activeLayout.request, start, end);
	activeLayout.nextStart = end;
	workerScope.postMessage({ end, positions, run, type: "positions" }, [positions.buffer]);
}

workerScope.addEventListener("message", ({ data }) => {
	if (data.type === "start") {
		activeLayout = {
			nextStart: 0,
			positions:
				data.layout === "forceatlas2"
					? forceAtlasPositions(data)
					: data.layout === "force-custom"
						? customForcePositions(data)
						: undefined,
			request: data,
		};
		postNextBatch(data.run);
		return;
	}
	postNextBatch(data.run);
});
