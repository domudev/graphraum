export interface ForceLayoutRequest {
	dimensions: 2 | 3;
	edges: Uint32Array;
	nodeCount: number;
}

export function forceIterationCount(nodeCount: number) {
	return Math.max(8, Math.min(32, Math.ceil(240 / Math.log2(nodeCount + 2))));
}

function initialPositions({ dimensions, nodeCount }: ForceLayoutRequest) {
	const positions = new Float32Array(nodeCount * 3);
	const radius = Math.max(Math.sqrt(nodeCount) * 6, 24);
	for (let index = 0; index < nodeCount; index += 1) {
		const offset = index * 3;
		const angle = (index / nodeCount) * Math.PI * 2;
		if (dimensions === 2) {
			positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], offset);
			continue;
		}
		const y = 1 - (2 * index + 1) / nodeCount;
		const planeRadius = Math.sqrt(1 - y * y) * radius;
		const spiral = index * Math.PI * (3 - Math.sqrt(5));
		positions.set([Math.cos(spiral) * planeRadius, y * radius, Math.sin(spiral) * planeRadius], offset);
	}
	return positions;
}

export function computeForcePositions(request: ForceLayoutRequest) {
	const positions = initialPositions(request);
	const iterations = forceIterationCount(request.nodeCount);
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const alpha = 1 - iteration / iterations;
		const center = [0, 0, 0];
		for (let index = 0; index < request.nodeCount; index += 1) {
			const offset = index * 3;
			for (let axis = 0; axis < request.dimensions; axis += 1) center[axis] += positions[offset + axis] ?? 0;
		}
		for (let axis = 0; axis < request.dimensions; axis += 1) center[axis] /= request.nodeCount;
		for (let index = 0; index < request.nodeCount; index += 1) {
			const offset = index * 3;
			const dx = (positions[offset] ?? 0) - center[0];
			const dy = (positions[offset + 1] ?? 0) - center[1];
			const dz = request.dimensions === 3 ? (positions[offset + 2] ?? 0) - center[2] : 0;
			const inverseDistance = 1 / Math.sqrt(Math.max(dx * dx + dy * dy + dz * dz, 1));
			positions[offset] = (positions[offset] ?? 0) + dx * inverseDistance * alpha;
			positions[offset + 1] = (positions[offset + 1] ?? 0) + dy * inverseDistance * alpha;
			positions[offset + 2] =
				request.dimensions === 3 ? (positions[offset + 2] ?? 0) + dz * inverseDistance * alpha : 0;
		}
		for (let index = 0; index < request.edges.length; index += 2) {
			const source = (request.edges[index] ?? 0) * 3;
			const target = (request.edges[index + 1] ?? 0) * 3;
			const dx = (positions[target] ?? 0) - (positions[source] ?? 0);
			const dy = (positions[target + 1] ?? 0) - (positions[source + 1] ?? 0);
			const dz = request.dimensions === 3 ? (positions[target + 2] ?? 0) - (positions[source + 2] ?? 0) : 0;
			const distance = Math.sqrt(Math.max(dx * dx + dy * dy + dz * dz, 0.0001));
			const force = Math.max(-0.1, Math.min(0.1, ((distance - 24) / distance) * 0.02 * alpha));
			positions[source] = (positions[source] ?? 0) + dx * force;
			positions[source + 1] = (positions[source + 1] ?? 0) + dy * force;
			positions[target] = (positions[target] ?? 0) - dx * force;
			positions[target + 1] = (positions[target + 1] ?? 0) - dy * force;
			if (request.dimensions === 3) {
				positions[source + 2] = (positions[source + 2] ?? 0) + dz * force;
				positions[target + 2] = (positions[target + 2] ?? 0) - dz * force;
			}
		}
	}
	return positions;
}
