export interface ForceLayoutRequest {
	dimensions: 2 | 3;
	edges: Uint32Array;
	nodeCount: number;
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
	const iterations = Math.max(8, Math.min(40, Math.floor(400_000 / request.nodeCount)));
	for (let iteration = 0; iteration < iterations; iteration += 1) {
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
			const distance = Math.max(Math.hypot(dx, dy, dz), 1);
			positions[offset] = (positions[offset] ?? 0) + dx / distance;
			positions[offset + 1] = (positions[offset + 1] ?? 0) + dy / distance;
			positions[offset + 2] = request.dimensions === 3 ? (positions[offset + 2] ?? 0) + dz / distance : 0;
		}
		for (let index = 0; index < request.edges.length; index += 2) {
			const source = (request.edges[index] ?? 0) * 3;
			const target = (request.edges[index + 1] ?? 0) * 3;
			const delta = [
				(positions[target] ?? 0) - (positions[source] ?? 0),
				(positions[target + 1] ?? 0) - (positions[source + 1] ?? 0),
				request.dimensions === 3 ? (positions[target + 2] ?? 0) - (positions[source + 2] ?? 0) : 0,
			];
			const distance = Math.max(Math.hypot(...delta), 0.01);
			const force = (distance - 24) * 0.002;
			for (let axis = 0; axis < request.dimensions; axis += 1) {
				positions[source + axis] = (positions[source + axis] ?? 0) + delta[axis] * force;
				positions[target + axis] = (positions[target + axis] ?? 0) - delta[axis] * force;
			}
		}
	}
	return positions;
}
