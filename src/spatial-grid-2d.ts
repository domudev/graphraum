import type { GraphraumNodeGeometry } from "./types";

export interface Bounds2D {
	bottom: number;
	left: number;
	right: number;
	top: number;
}

/** A mutable uniform grid shared by 2D picking and viewport visibility queries. */
export class SpatialGrid2D {
	private readonly cells = new Map<string, number[]>();
	private readonly cellKeys: (string | undefined)[] = [];
	private readonly nodes: (GraphraumNodeGeometry | undefined)[] = [];
	private maxRadius = 0;

	constructor(private readonly cellSize = 32) {
		if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error("Spatial grid cell size must be positive.");
	}

	set(index: number, node: GraphraumNodeGeometry) {
		const previousKey = this.cellKeys[index];
		if (previousKey) {
			const previousCell = this.cells.get(previousKey);
			if (previousCell) {
				const position = previousCell.indexOf(index);
				if (position >= 0) previousCell.splice(position, 1);
				if (previousCell.length === 0) this.cells.delete(previousKey);
			}
		}

		const key = this.key(this.coordinate(node.position.x), this.coordinate(node.position.y));
		const cell = this.cells.get(key) ?? [];
		cell.push(index);
		this.cells.set(key, cell);
		this.cellKeys[index] = key;
		this.nodes[index] = node;
		this.maxRadius = Math.max(this.maxRadius, node.size ?? 4);
	}

	pick(x: number, y: number): number | null {
		const cellRadius = Math.ceil(this.maxRadius / this.cellSize);
		const centerX = this.coordinate(x);
		const centerY = this.coordinate(y);
		let nearestIndex: number | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;

		for (let cellY = centerY - cellRadius; cellY <= centerY + cellRadius; cellY += 1) {
			for (let cellX = centerX - cellRadius; cellX <= centerX + cellRadius; cellX += 1) {
				for (const index of this.cells.get(this.key(cellX, cellY)) ?? []) {
					const node = this.nodes[index];
					if (!node) continue;
					const distance = (node.position.x - x) ** 2 + (node.position.y - y) ** 2;
					if (distance <= (node.size ?? 4) ** 2 && distance < nearestDistance) {
						nearestDistance = distance;
						nearestIndex = index;
					}
				}
			}
		}
		return nearestIndex;
	}

	queryBounds(bounds: Bounds2D, overscan = 0): readonly number[] {
		const left = bounds.left - overscan;
		const right = bounds.right + overscan;
		const bottom = bounds.bottom - overscan;
		const top = bounds.top + overscan;
		const indices: number[] = [];
		for (
			let cellY = this.coordinate(bottom - this.maxRadius);
			cellY <= this.coordinate(top + this.maxRadius);
			cellY += 1
		) {
			for (
				let cellX = this.coordinate(left - this.maxRadius);
				cellX <= this.coordinate(right + this.maxRadius);
				cellX += 1
			) {
				for (const index of this.cells.get(this.key(cellX, cellY)) ?? []) {
					const node = this.nodes[index];
					if (!node) continue;
					const radius = node.size ?? 4;
					if (
						node.position.x + radius >= left &&
						node.position.x - radius <= right &&
						node.position.y + radius >= bottom &&
						node.position.y - radius <= top
					) {
						indices.push(index);
					}
				}
			}
		}
		return indices;
	}

	private coordinate(value: number) {
		return Math.floor(value / this.cellSize);
	}

	private key(x: number, y: number) {
		return `${x}:${y}`;
	}
}
