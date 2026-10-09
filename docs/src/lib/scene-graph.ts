import type { DemoEdgeAttributes, DemoNodeAttributes, DemoUseCase, DemoUseCaseId } from "./use-case-demos";

type DemoNode = DemoUseCase["data"]["nodes"][number];
type DemoEdge = DemoUseCase["data"]["edges"][number];

interface ContextKind {
	category: string;
	color: string;
	names: readonly string[];
	relationship: string;
	subtitle: string;
}

const edgeColor = "#356b5a";

/** Context entities that grow each curated demo into a graph worth exploring. */
const contextKinds: Record<DemoUseCaseId, readonly ContextKind[]> = {
	knowledge: [
		{
			category: "Person",
			color: "#73c7a5",
			names: [
				"Lena Becker",
				"Jonas Wolf",
				"Mara Klein",
				"Felix Braun",
				"Sofia Hartmann",
				"Paul Neumann",
				"Clara Zimmer",
				"Tim Krüger",
			],
			relationship: "Corresponded with",
			subtitle: "Person",
		},
		{
			category: "Place",
			color: "#58a6c7",
			names: ["Paris", "Turin", "Cambridge", "Edinburgh", "Bath", "Dublin", "Geneva", "Florence"],
			relationship: "Visited",
			subtitle: "Place",
		},
		{
			category: "Concept",
			color: "#d6a84b",
			names: [
				"Punched cards",
				"Difference engine",
				"Calculus",
				"Logic",
				"Notation",
				"Algorithm",
				"Loom",
				"Symbolic algebra",
			],
			relationship: "Wrote about",
			subtitle: "Concept",
		},
		{
			category: "Source",
			color: "#fcfffc",
			names: ["Letter", "Lecture note", "Translation", "Diary entry", "Patent", "Review"],
			relationship: "Cited in",
			subtitle: "Source document",
		},
	],
	dependencies: [
		{
			category: "Service",
			color: "#73c7a5",
			names: [
				"orders",
				"inventory",
				"search",
				"pricing",
				"shipping",
				"notifications",
				"accounts",
				"catalog",
				"reviews",
			],
			relationship: "Calls",
			subtitle: "Service",
		},
		{
			category: "Database",
			color: "#b875d5",
			names: ["orders-db", "events-db", "cache", "search-index", "ledger", "sessions"],
			relationship: "Reads and writes",
			subtitle: "Data store",
		},
		{
			category: "Gateway",
			color: "#d6a84b",
			names: ["public-gw", "partner-gw", "internal-gw", "webhook-gw"],
			relationship: "Routes to",
			subtitle: "Gateway",
		},
		{
			category: "Application",
			color: "#58a6c7",
			names: ["web", "ios", "android", "admin", "partner-portal"],
			relationship: "Depends on",
			subtitle: "Client application",
		},
	],
	investigation: [
		{
			category: "Account",
			color: "#ef8f72",
			names: ["Account", "Account", "Account"],
			relationship: "Linked to",
			subtitle: "Customer account",
		},
		{
			category: "Device",
			color: "#58a6c7",
			names: ["Device"],
			relationship: "Signed in from",
			subtitle: "Browser fingerprint",
		},
		{
			category: "Payment method",
			color: "#b875d5",
			names: ["Card", "Wallet", "IBAN"],
			relationship: "Paid with",
			subtitle: "Payment method",
		},
		{
			category: "Merchant",
			color: "#73c7a5",
			names: ["Merchant Nord", "Merchant Süd", "Marketplace", "Gift cards", "Electronics"],
			relationship: "Paid at",
			subtitle: "Merchant",
		},
	],
};

function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<Item>(items: readonly Item[], next: () => number): Item {
	const item = items[Math.floor(next() * items.length)];
	if (item === undefined) throw new Error("Cannot pick from an empty list");
	return item;
}

function contextLabel(kind: ContextKind, index: number, next: () => number): string {
	const name = pick(kind.names, next);
	if (kind.category === "Account" || kind.category === "Device") return `${name} ${(1000 + index * 37) % 9000}`;
	if (kind.category === "Payment method") return `${name} ${String(1000 + ((index * 53) % 9000))}`;
	if (kind.category === "Service" || kind.category === "Database") return `${name}-${index % 7}`;
	if (kind.category === "Source") return `${name} ${1830 + (index % 25)}`;
	return index < kind.names.length * 2 ? name : `${name} ${Math.floor(index / kind.names.length)}`;
}

/**
 * Grows a curated demo into a larger, deterministic graph. Every curated node becomes a hub with its
 * own cluster of generated context entities, so the original entities and actions stay intact.
 */
export function expandUseCase(useCase: DemoUseCase, extraNodes: number, seed = 7): DemoUseCase {
	if (!Number.isSafeInteger(extraNodes) || extraNodes < 0) throw new Error("extraNodes must be a non-negative integer");
	const next = random(seed);
	const kinds = contextKinds[useCase.id];
	const hubs = useCase.data.nodes;
	const nodes: DemoNode[] = hubs.map((node) => ({
		...node,
		position: { x: node.position.x * 2.2, y: node.position.y * 2.2 },
	}));
	const edges: DemoEdge[] = [...useCase.data.edges];
	const clusterMembers = hubs.map((hub) => [hub.id]);

	const addEdge = (source: string, target: string, relationship: string) => {
		const attributes: DemoEdgeAttributes = { color: edgeColor, properties: [], relationship };
		edges.push({ attributes, id: `context-edge-${edges.length}`, source, target });
	};

	const positions = new Map(nodes.map((node) => [node.id, node.position]));
	const labels = new Set(nodes.map((node) => node.attributes.label));
	const uniqueLabel = (candidate: string) => {
		let label = candidate;
		for (let suffix = 2; labels.has(label); suffix += 1) label = `${candidate} ${suffix}`;
		labels.add(label);
		return label;
	};
	for (let index = 0; index < extraNodes; index += 1) {
		const cluster = Math.floor(next() * hubs.length);
		const hub = hubs[cluster];
		const members = clusterMembers[cluster];
		if (!hub || !members) throw new Error("Cluster index out of range");
		// Grow branches: most context attaches to an earlier member, so clusters read as trees, not stars.
		const parentId = next() < 0.3 ? hub.id : pick(members, next);
		const parent = positions.get(parentId);
		if (!parent) throw new Error(`Missing position for ${parentId}`);
		const kind = pick(kinds, next);
		const angle = next() * Math.PI * 2;
		const radius = 24 + next() * 56;
		const label = uniqueLabel(contextLabel(kind, index, next));
		const attributes: DemoNodeAttributes = {
			category: kind.category,
			color: kind.color,
			label,
			primaryActionFeedback: `${label} opened in the application-owned inspector.`,
			primaryActionLabel: "Open",
			properties: [{ id: "kind", label: "Kind", value: kind.subtitle }],
			size: 3 + next() * 4,
			subtitle: kind.subtitle,
		};
		const id = `${useCase.id}-context-${index}`;
		const position = { x: parent.x + Math.cos(angle) * radius, y: parent.y + Math.sin(angle) * radius };
		nodes.push({ attributes, id, position });
		positions.set(id, position);
		addEdge(parentId, id, kind.relationship);
		if (next() < 0.12) addEdge(id, pick(members, next), kind.relationship);
		if (next() < 0.03) addEdge(id, pick(nodes, next).id, kind.relationship);
		members.push(id);
	}

	return { ...useCase, data: { edges, nodes } };
}
