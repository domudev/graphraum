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
	const extent = Math.max(Math.sqrt(nodeCount) * 6, 24);
	for (let index = 0; index < nodeCount; index += 1) {
		const offset = index * 3;
		const angle = random(index * 4 + 1) * Math.PI * 2;
		if (dimensions === 2) {
			const radius = Math.sqrt(random(index * 4 + 2)) * extent * 0.5;
			positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], offset);
			continue;
		}
		const zDirection = random(index * 4 + 2) * 2 - 1;
		const planeRadius = Math.sqrt(1 - zDirection * zDirection);
		const radius = Math.cbrt(random(index * 4 + 3)) * extent * 0.5;
		positions.set(
			[Math.cos(angle) * planeRadius * radius, Math.sin(angle) * planeRadius * radius, zDirection * radius],
			offset,
		);
	}
	return positions;
}

function random(seed: number) {
	let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
	value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
	return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

export function computeForcePositions(request: ForceLayoutRequest) {
	const positions = initialPositions(request);
	const velocities = new Float32Array(positions.length);
	const forces = new Float32Array(positions.length);
	const iterations = forceIterationCount(request.nodeCount);
	for (let iteration = 0; iteration < iterations; iteration += 1) {
		const alpha = 1 - iteration / iterations;
		forces.fill(0);
		for (let index = 0; index < request.nodeCount; index += 1) {
			const offset = index * 3;
			forces[offset] = -(positions[offset] ?? 0) * 0.002 * alpha;
			forces[offset + 1] = -(positions[offset + 1] ?? 0) * 0.002 * alpha;
			forces[offset + 2] = request.dimensions === 3 ? -(positions[offset + 2] ?? 0) * 0.002 * alpha : 0;
			for (let sample = 0; sample < 8; sample += 1) {
				const targetIndex = Math.floor(random(index * 97 + sample * 17 + iteration * 13) * request.nodeCount);
				if (targetIndex === index) continue;
				const target = targetIndex * 3;
				const dx = (positions[offset] ?? 0) - (positions[target] ?? 0);
				const dy = (positions[offset + 1] ?? 0) - (positions[target + 1] ?? 0);
				const dz = request.dimensions === 3 ? (positions[offset + 2] ?? 0) - (positions[target + 2] ?? 0) : 0;
				const distanceSquared = dx * dx + dy * dy + dz * dz + 16;
				const scale = (Math.min(2, 400 / distanceSquared) * alpha) / Math.sqrt(distanceSquared);
				forces[offset] += dx * scale;
				forces[offset + 1] += dy * scale;
				if (request.dimensions === 3) forces[offset + 2] += dz * scale;
			}
		}
		for (let index = 0; index < request.edges.length; index += 2) {
			const source = (request.edges[index] ?? 0) * 3;
			const target = (request.edges[index + 1] ?? 0) * 3;
			const dx = (positions[target] ?? 0) - (positions[source] ?? 0);
			const dy = (positions[target + 1] ?? 0) - (positions[source + 1] ?? 0);
			const dz = request.dimensions === 3 ? (positions[target + 2] ?? 0) - (positions[source + 2] ?? 0) : 0;
			const distance = Math.sqrt(Math.max(dx * dx + dy * dy + dz * dz, 0.0001));
			const force = Math.max(-1, Math.min(1, (distance - 24) * 0.005 * alpha)) / distance;
			forces[source] += dx * force;
			forces[source + 1] += dy * force;
			forces[target] -= dx * force;
			forces[target + 1] -= dy * force;
			if (request.dimensions === 3) {
				forces[source + 2] += dz * force;
				forces[target + 2] -= dz * force;
			}
		}
		for (let index = 0; index < request.nodeCount; index += 1) {
			const offset = index * 3;
			let vx = ((velocities[offset] ?? 0) + (forces[offset] ?? 0)) * 0.82;
			let vy = ((velocities[offset + 1] ?? 0) + (forces[offset + 1] ?? 0)) * 0.82;
			let vz = request.dimensions === 3 ? ((velocities[offset + 2] ?? 0) + (forces[offset + 2] ?? 0)) * 0.82 : 0;
			const speed = Math.hypot(vx, vy, vz);
			const maxSpeed = 0.5 + alpha * 8;
			if (speed > maxSpeed) {
				const scale = maxSpeed / speed;
				vx *= scale;
				vy *= scale;
				vz *= scale;
			}
			velocities[offset] = vx;
			velocities[offset + 1] = vy;
			velocities[offset + 2] = vz;
			positions[offset] = (positions[offset] ?? 0) + vx;
			positions[offset + 1] = (positions[offset + 1] ?? 0) + vy;
			positions[offset + 2] = request.dimensions === 3 ? (positions[offset + 2] ?? 0) + vz : 0;
		}
	}
	return positions;
}
