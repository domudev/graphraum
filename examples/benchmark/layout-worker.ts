import { computeForcePositions } from "./force-layout";

type LayoutName = "circle" | "force" | "grid";

type LayoutRequest = {
	batchSize: number;
	dimensions: 2 | 3;
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
				data.layout === "force"
					? computeForcePositions({
							dimensions: data.dimensions,
							edges: data.edges ?? new Uint32Array(),
							nodeCount: data.nodeCount,
						})
					: undefined,
			request: data,
		};
		postNextBatch(data.run);
		return;
	}
	postNextBatch(data.run);
});
