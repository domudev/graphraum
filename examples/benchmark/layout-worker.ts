type LayoutBaseRequest = {
	batchSize: number;
	nodeCount: number;
	run: number;
};

type LayoutGridOrCircleRequest = LayoutBaseRequest & { layout: "circle" | "grid" };

type LayoutForcePhysicsRequest = {
	edges: Uint32Array;
	forceCycles: number;
	forceDist: number;
	forceGravity: number;
	forceRepulsion: number;
	forceSpring: number;
};

type LayoutForceRequest = LayoutBaseRequest &
	LayoutForcePhysicsRequest & {
		layout: "force";
	};

type LayoutForceLiveRequest = LayoutBaseRequest &
	LayoutForcePhysicsRequest & {
		layout: "force-live";
		maxFps: number;
	};

type LayoutRequest = LayoutGridOrCircleRequest | LayoutForceRequest | LayoutForceLiveRequest;

type LayoutWorkerMessage =
	| ({ type: "start" } & LayoutRequest)
	| { run: number; type: "next" }
	| { nodeIndex: number; position: [number, number, number]; run: number; type: "pin-node" }
	| { nodeIndex: number; run: number; type: "unpin-node" };

type LayoutState = {
	forces?: Float32Array;
	nextStart: number;
	pinnedNodes?: Map<number, [number, number, number]>;
	request: LayoutRequest;
	timer?: number;
	step?: number;
	velocities?: Float32Array;
	positions?: Float32Array;
};

type WorkerScope = {
	addEventListener(type: "message", listener: (event: MessageEvent<LayoutWorkerMessage>) => void): void;
	postMessage(message: unknown, transfer: Transferable[]): void;
};

const workerScope = self as unknown as WorkerScope;
let activeLayout: LayoutState | undefined;

function deterministicRandom(seed: number) {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return (seed >>> 0) / 0x1_0000_0000;
}

function createInitialPosition(nodeCount: number, index: number) {
	const columns = Math.ceil(Math.sqrt(nodeCount));
	const radius = Math.max(Math.sqrt(nodeCount) * 6, 24);
	const angle = (index / nodeCount) * Math.PI * 2;
	return {
		x: Math.cos(angle) * radius,
		y: Math.sin(angle) * radius,
		z: (index % columns) * 4 - (columns - 1) * 2,
	};
}

function initializePositions(nodeCount: number) {
	const positions = new Float32Array(nodeCount * 3);
	for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
		const offset = nodeIndex * 3;
		const initial = createInitialPosition(nodeCount, nodeIndex);
		positions[offset] = initial.x;
		positions[offset + 1] = initial.y;
		positions[offset + 2] = initial.z;
	}
	return positions;
}

function applyForceIteration(
	request: LayoutForceRequest | LayoutForceLiveRequest,
	positions: Float32Array,
	velocities: Float32Array,
	forces: Float32Array,
	pinnedNodes?: Map<number, [number, number, number]>,
	step = 0,
) {
	const nodeCount = request.nodeCount;
	const damping = 0.85;
	forces.fill(0);

	for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
		const offset = nodeIndex * 3;
		const sampleSeed = (nodeIndex * 1_103_515_245 + step * 1_014_904_223 + request.forceRepulsion + 123_456_789) >>> 0;
		for (let sampleIndex = 0; sampleIndex < 8; sampleIndex += 1) {
			const randomOffset = deterministicRandom(sampleSeed + sampleIndex * 4_294_967);
			const targetIndex = Math.floor(randomOffset * nodeCount);
			if (targetIndex === nodeIndex) continue;
			const targetOffset = targetIndex * 3;
			const dx = positions[offset] - positions[targetOffset];
			const dy = positions[offset + 1] - positions[targetOffset + 1];
			const dz = positions[offset + 2] - positions[targetOffset + 2];
			const distanceSquared = dx * dx + dy * dy + dz * dz;
			const strength = request.forceRepulsion / (distanceSquared + 48);
			forces[offset] += dx * strength;
			forces[offset + 1] += dy * strength;
			forces[offset + 2] += dz * strength;
		}
	}
	// ponytail: sampled repulsion instead of full pairwise O(n²) to keep 100k-node runs practical.

	for (let edgeOffset = 0; edgeOffset < request.edges.length; edgeOffset += 2) {
		const sourceIndex = request.edges[edgeOffset];
		const targetIndex = request.edges[edgeOffset + 1];
		if (sourceIndex === targetIndex) continue;
		const sourceOffset = sourceIndex * 3;
		const targetOffset = targetIndex * 3;
		const dx = positions[sourceOffset] - positions[targetOffset];
		const dy = positions[sourceOffset + 1] - positions[targetOffset + 1];
		const dz = positions[sourceOffset + 2] - positions[targetOffset + 2];
		const distance = Math.hypot(dx, dy, dz) + 0.001;
		const stretch = (distance - request.forceDist) * request.forceSpring;
		const nx = dx / distance;
		const ny = dy / distance;
		const nz = dz / distance;
		forces[sourceOffset] += -nx * stretch;
		forces[sourceOffset + 1] += -ny * stretch;
		forces[sourceOffset + 2] += -nz * stretch;
		forces[targetOffset] -= -nx * stretch;
		forces[targetOffset + 1] -= -ny * stretch;
		forces[targetOffset + 2] -= -nz * stretch;
	}

	for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
		const offset = nodeIndex * 3;
		const pinned = pinnedNodes?.get(nodeIndex);
		if (pinned) {
			positions[offset] = pinned[0];
			positions[offset + 1] = pinned[1];
			positions[offset + 2] = pinned[2];
			velocities[offset] = 0;
			velocities[offset + 1] = 0;
			velocities[offset + 2] = 0;
			continue;
		}
		const gravity = request.forceGravity;
		positions[offset] += velocities[offset] =
			(velocities[offset] + forces[offset] - positions[offset] * gravity) * damping;
		positions[offset + 1] += velocities[offset + 1] =
			(velocities[offset + 1] + forces[offset + 1] - positions[offset + 1] * gravity) * damping;
		positions[offset + 2] += velocities[offset + 2] =
			(velocities[offset + 2] + forces[offset + 2] - positions[offset + 2] * gravity) * damping;
	}
}

function computeForcePositions(request: LayoutForceRequest) {
	const nodeCount = request.nodeCount;
	const positions = initializePositions(nodeCount);
	const velocities = new Float32Array(nodeCount * 3);
	const forces = new Float32Array(nodeCount * 3);
	for (let iteration = 0; iteration < request.forceCycles; iteration += 1) {
		applyForceIteration(request, positions, velocities, forces, undefined, iteration);
	}
	return positions;
}

function scheduleForceLiveFrame(state: LayoutState) {
	if (state.request.layout !== "force-live") return;
	const request = state.request;
	const positions = state.positions;
	const velocities = state.velocities;
	const forces = state.forces;
	const pinnedNodes = state.pinnedNodes;
	if (!positions || !velocities || !forces) return;
	const intervalMs = Math.max(1, Math.round(1000 / request.maxFps));
	state.timer = setTimeout(() => {
		if (activeLayout !== state || activeLayout?.request.run !== request.run) return;
		state.step = (state.step ?? 0) + 1;
		applyForceIteration(request, positions, velocities, forces, pinnedNodes, state.step);
		const snapshot = positions.slice();
		workerScope.postMessage({ end: request.nodeCount, positions: snapshot, run: request.run, type: "positions" }, [
			snapshot.buffer,
		]);
		scheduleForceLiveFrame(state);
	}, intervalMs);
}

function stopForceLiveLayout(state: LayoutState | undefined) {
	if (state?.request.layout !== "force-live" || state.timer === undefined) return;
	clearTimeout(state.timer);
	state.timer = undefined;
}

function postNextBatch(run: number) {
	if (!activeLayout || activeLayout.request.run !== run || activeLayout.request.layout === "force-live") return;
	const nextStart = activeLayout.nextStart;
	const nodeCount = activeLayout.request.nodeCount;
	if (nextStart === nodeCount) {
		activeLayout = undefined;
		workerScope.postMessage({ run, type: "complete" }, []);
		return;
	}
	const end = Math.min(nextStart + activeLayout.request.batchSize, nodeCount);
	const request = activeLayout.request;
	let positions: Float32Array;
	if (request.layout === "force") {
		if (!activeLayout.positions) return;
		positions = activeLayout.positions.slice(nextStart * 3, end * 3);
	} else {
		positions = positionsFor(request, nextStart, end);
	}
	activeLayout.nextStart = end;
	workerScope.postMessage({ end, positions, run, type: "positions" }, [positions.buffer]);
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

function pinNode(layout: LayoutState, nodeIndex: number, position: [number, number, number]) {
	const request = layout.request;
	if (request.layout !== "force-live") return;
	if (nodeIndex < 0 || nodeIndex >= request.nodeCount) return;
	if (position.some((value) => !Number.isFinite(value))) return;
	const pinnedNodes = layout.pinnedNodes ?? new Map<number, [number, number, number]>();
	pinnedNodes.set(nodeIndex, position);
	layout.pinnedNodes = pinnedNodes;
	if (!layout.positions || !layout.velocities) return;
	const offset = nodeIndex * 3;
	layout.positions[offset] = position[0];
	layout.positions[offset + 1] = position[1];
	layout.positions[offset + 2] = position[2];
	layout.velocities[offset] = 0;
	layout.velocities[offset + 1] = 0;
	layout.velocities[offset + 2] = 0;
}

function unpinNode(layout: LayoutState, nodeIndex: number) {
	layout.pinnedNodes?.delete(nodeIndex);
}

function onStart(request: LayoutForceLiveRequest | LayoutForceRequest | LayoutGridOrCircleRequest) {
	stopForceLiveLayout(activeLayout);
	if (request.layout === "force-live") {
		const positions = initializePositions(request.nodeCount);
		const velocities = new Float32Array(request.nodeCount * 3);
		const forces = new Float32Array(request.nodeCount * 3);
		activeLayout = {
			nextStart: 0,
			pinnedNodes: new Map(),
			request,
			positions,
			velocities,
			forces,
			step: 0,
		};
		const initial = positions.slice();
		workerScope.postMessage({ end: request.nodeCount, positions: initial, run: request.run, type: "positions" }, [
			initial.buffer,
		]);
		scheduleForceLiveFrame(activeLayout);
		return;
	}
	if (request.layout === "force") {
		const forcePositions = computeForcePositions(request);
		activeLayout = { nextStart: 0, positions: forcePositions, request };
		postNextBatch(request.run);
		return;
	}
	activeLayout = { nextStart: 0, request };
	postNextBatch(request.run);
}

workerScope.addEventListener("message", ({ data }: MessageEvent<LayoutWorkerMessage>) => {
	if (data.type === "start") {
		onStart(data);
		return;
	}
	if (data.type === "next") {
		postNextBatch(data.run);
		return;
	}
	if (!activeLayout || activeLayout.request.run !== data.run) return;
	if (data.type === "pin-node") {
		pinNode(activeLayout, data.nodeIndex, data.position);
		return;
	}
	unpinNode(activeLayout, data.nodeIndex);
});
