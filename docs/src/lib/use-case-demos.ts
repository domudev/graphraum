import type { GraphraumData, GraphraumNodeShape, GraphraumPresentationProperty } from "../../../src/types";
import { defineVisuals } from "../../../src/visuals";

export type DemoUseCaseId = "dependencies" | "investigation" | "knowledge";

export interface DemoNodeAttributes {
	category: string;
	color: string;
	label: string;
	primaryActionFeedback: string;
	primaryActionLabel: string;
	properties: readonly GraphraumPresentationProperty[];
	size: number;
	subtitle: string;
}

export interface DemoEdgeAttributes {
	color: string;
	properties: readonly GraphraumPresentationProperty[];
	relationship: string;
}

export interface DemoUseCase {
	data: GraphraumData<DemoNodeAttributes, DemoEdgeAttributes>;
	description: string;
	id: DemoUseCaseId;
	kicker: string;
	title: string;
}

export interface DemoActionResult {
	message: string;
	selectedNodeIds: readonly string[];
}

const palette = {
	amber: "#d6a84b",
	blue: "#58a6c7",
	coral: "#ef8f72",
	edge: "#356b5a",
	mint: "#73c7a5",
	purple: "#b875d5",
} as const;

const squareCategories = new Set(["Database", "Payment method", "Place", "Service"]);
const diamondCategories = new Set(["Concept", "Device", "Field", "Gateway"]);

function shapeForCategory(category: string): GraphraumNodeShape {
	if (squareCategories.has(category)) return "square";
	if (diamondCategories.has(category)) return "diamond";
	return "circle";
}

function property(id: string, label: string, value: boolean | null | number | string): GraphraumPresentationProperty {
	return { id, label, value };
}

export const demoVisuals = defineVisuals<DemoNodeAttributes, DemoEdgeAttributes>({
	edge: (edge) => ({
		presentation: {
			properties: edge.attributes.properties,
			title: edge.attributes.relationship,
		},
		visual: { color: edge.attributes.color },
	}),
	node: (node) => ({
		presentation: {
			actions: [
				{ id: "trace-connections", label: "Trace connections" },
				{ id: "primary", label: node.attributes.primaryActionLabel },
			],
			properties: node.attributes.properties,
			subtitle: node.attributes.subtitle,
			title: node.attributes.label,
		},
		visual: {
			color: node.attributes.color,
			shape: shapeForCategory(node.attributes.category),
			size: node.attributes.size,
		},
	}),
});

const knowledge = {
	id: "knowledge",
	kicker: "Knowledge graph",
	title: "Connect people, ideas, and evidence",
	description: "Explore a compact research graph, inspect provenance, and trace the context around one entity.",
	data: {
		nodes: [
			{
				id: "ada",
				position: { x: -105, y: 10 },
				attributes: {
					category: "Person",
					color: palette.mint,
					label: "Ada Lovelace",
					primaryActionFeedback: "Ada Lovelace opened in the application-owned entity inspector.",
					primaryActionLabel: "Open entity",
					properties: [property("kind", "Kind", "Person"), property("sources", "Sources", 8)],
					size: 11,
					subtitle: "Mathematician and writer",
				},
			},
			{
				id: "analytical-engine",
				position: { x: 10, y: 70 },
				attributes: {
					category: "Concept",
					color: palette.amber,
					label: "Analytical Engine",
					primaryActionFeedback: "The Analytical Engine evidence bundle is ready to inspect.",
					primaryActionLabel: "Inspect evidence",
					properties: [property("kind", "Kind", "Invention"), property("sources", "Sources", 12)],
					size: 13,
					subtitle: "General-purpose mechanical computer",
				},
			},
			{
				id: "london",
				position: { x: -5, y: -85 },
				attributes: {
					category: "Place",
					color: palette.blue,
					label: "London",
					primaryActionFeedback: "London opened with its connected people and documents.",
					primaryActionLabel: "Open place",
					properties: [property("kind", "Kind", "Place"), property("entities", "Entities", 31)],
					size: 10,
					subtitle: "United Kingdom",
				},
			},
			{
				id: "mathematics",
				position: { x: -190, y: -90 },
				attributes: {
					category: "Field",
					color: palette.purple,
					label: "Mathematics",
					primaryActionFeedback: "The Mathematics topic cluster is ready to inspect.",
					primaryActionLabel: "Open topic",
					properties: [property("kind", "Kind", "Discipline"), property("entities", "Entities", 24)],
					size: 12,
					subtitle: "Formal science",
				},
			},
			{
				id: "charles",
				position: { x: 145, y: 15 },
				attributes: {
					category: "Person",
					color: palette.mint,
					label: "Charles Babbage",
					primaryActionFeedback: "Charles Babbage opened in the application-owned entity inspector.",
					primaryActionLabel: "Open entity",
					properties: [property("kind", "Kind", "Person"), property("sources", "Sources", 10)],
					size: 11,
					subtitle: "Mathematician and inventor",
				},
			},
		],
		edges: [
			{
				id: "ada-engine",
				source: "ada",
				target: "analytical-engine",
				attributes: {
					color: palette.edge,
					properties: [property("source", "Source", "Note G")],
					relationship: "Wrote the first published algorithm for",
				},
			},
			{
				id: "ada-london",
				source: "ada",
				target: "london",
				attributes: {
					color: palette.blue,
					properties: [property("confidence", "Confidence", 0.99)],
					relationship: "Lived in",
				},
			},
			{
				id: "ada-mathematics",
				source: "ada",
				target: "mathematics",
				attributes: {
					color: palette.purple,
					properties: [property("confidence", "Confidence", 0.97)],
					relationship: "Worked in",
				},
			},
			{
				id: "charles-engine",
				source: "charles",
				target: "analytical-engine",
				attributes: {
					color: palette.edge,
					properties: [property("source", "Source", "Design notebooks")],
					relationship: "Designed",
				},
			},
			{
				id: "charles-london",
				source: "charles",
				target: "london",
				attributes: {
					color: palette.blue,
					properties: [property("confidence", "Confidence", 0.99)],
					relationship: "Lived in",
				},
			},
		],
	},
} satisfies DemoUseCase;

const dependencies = {
	id: "dependencies",
	kicker: "Software topology",
	title: "Follow dependencies before they become incidents",
	description: "Trace service ownership, shared infrastructure, and the blast radius of a critical dependency.",
	data: {
		nodes: [
			{
				id: "web",
				position: { x: -175, y: 15 },
				attributes: {
					category: "Application",
					color: palette.blue,
					label: "Customer web",
					primaryActionFeedback: "Customer web opened in the service catalog.",
					primaryActionLabel: "Open service",
					properties: [property("team", "Team", "Experience"), property("status", "Status", "Healthy")],
					size: 12,
					subtitle: "Public application",
				},
			},
			{
				id: "gateway",
				position: { x: -65, y: 75 },
				attributes: {
					category: "Service",
					color: palette.mint,
					label: "API gateway",
					primaryActionFeedback: "API gateway opened in the service catalog.",
					primaryActionLabel: "Open service",
					properties: [property("team", "Team", "Platform"), property("latency", "p95 latency", "84 ms")],
					size: 11,
					subtitle: "Edge routing service",
				},
			},
			{
				id: "auth",
				position: { x: 65, y: 85 },
				attributes: {
					category: "Service",
					color: palette.mint,
					label: "Identity service",
					primaryActionFeedback: "Identity service opened in the service catalog.",
					primaryActionLabel: "Open service",
					properties: [property("team", "Team", "Identity"), property("status", "Status", "Degraded")],
					size: 13,
					subtitle: "Authentication and sessions",
				},
			},
			{
				id: "billing",
				position: { x: 70, y: -65 },
				attributes: {
					category: "Service",
					color: palette.amber,
					label: "Billing service",
					primaryActionFeedback: "Billing service opened in the service catalog.",
					primaryActionLabel: "Open service",
					properties: [property("team", "Team", "Revenue"), property("status", "Status", "Healthy")],
					size: 12,
					subtitle: "Subscriptions and invoices",
				},
			},
			{
				id: "postgres",
				position: { x: 190, y: 15 },
				attributes: {
					category: "Database",
					color: palette.purple,
					label: "Primary database",
					primaryActionFeedback: "Primary database metrics opened for investigation.",
					primaryActionLabel: "Open metrics",
					properties: [property("engine", "Engine", "PostgreSQL"), property("region", "Region", "eu-central")],
					size: 14,
					subtitle: "Shared persistence",
				},
			},
		],
		edges: [
			{
				id: "web-gateway",
				source: "web",
				target: "gateway",
				attributes: {
					color: palette.blue,
					properties: [property("protocol", "Protocol", "HTTPS")],
					relationship: "Calls",
				},
			},
			{
				id: "gateway-auth",
				source: "gateway",
				target: "auth",
				attributes: {
					color: palette.coral,
					properties: [property("requests", "Requests / min", 18420)],
					relationship: "Authenticates through",
				},
			},
			{
				id: "gateway-billing",
				source: "gateway",
				target: "billing",
				attributes: {
					color: palette.amber,
					properties: [property("requests", "Requests / min", 3210)],
					relationship: "Routes to",
				},
			},
			{
				id: "auth-postgres",
				source: "auth",
				target: "postgres",
				attributes: {
					color: palette.purple,
					properties: [property("pool", "Connection pool", 80)],
					relationship: "Reads and writes",
				},
			},
			{
				id: "billing-postgres",
				source: "billing",
				target: "postgres",
				attributes: {
					color: palette.purple,
					properties: [property("pool", "Connection pool", 40)],
					relationship: "Reads and writes",
				},
			},
		],
	},
} satisfies DemoUseCase;

const investigation = {
	id: "investigation",
	kicker: "Fraud investigation",
	title: "Surface suspicious connections without losing context",
	description: "Inspect accounts, devices, and transactions while the host application owns review actions and state.",
	data: {
		nodes: [
			{
				id: "account-a",
				position: { x: -150, y: 25 },
				attributes: {
					category: "Account",
					color: palette.coral,
					label: "Account A",
					primaryActionFeedback: "Account A added to the investigation review queue.",
					primaryActionLabel: "Add to review",
					properties: [property("risk", "Risk score", 91), property("country", "Country", "DE")],
					size: 14,
					subtitle: "High-risk customer account",
				},
			},
			{
				id: "account-b",
				position: { x: 145, y: 55 },
				attributes: {
					category: "Account",
					color: palette.amber,
					label: "Account B",
					primaryActionFeedback: "Account B added to the investigation review queue.",
					primaryActionLabel: "Add to review",
					properties: [property("risk", "Risk score", 68), property("country", "Country", "NL")],
					size: 12,
					subtitle: "Linked customer account",
				},
			},
			{
				id: "device",
				position: { x: -15, y: 95 },
				attributes: {
					category: "Device",
					color: palette.blue,
					label: "Device 7F2A",
					primaryActionFeedback: "Device 7F2A fingerprint details opened.",
					primaryActionLabel: "Inspect device",
					properties: [property("accounts", "Linked accounts", 2), property("firstSeen", "First seen", "18 Jul")],
					size: 11,
					subtitle: "Shared browser fingerprint",
				},
			},
			{
				id: "payment",
				position: { x: 5, y: -85 },
				attributes: {
					category: "Payment",
					color: palette.purple,
					label: "Payment method 8842",
					primaryActionFeedback: "Payment method 8842 evidence opened.",
					primaryActionLabel: "Inspect payment",
					properties: [property("accounts", "Linked accounts", 2), property("issuer", "Issuer", "Example Bank")],
					size: 11,
					subtitle: "Shared card token",
				},
			},
			{
				id: "merchant",
				position: { x: 175, y: -70 },
				attributes: {
					category: "Merchant",
					color: palette.mint,
					label: "Merchant Q",
					primaryActionFeedback: "Merchant Q transaction history opened.",
					primaryActionLabel: "Open merchant",
					properties: [property("transactions", "Transactions", 148), property("chargebacks", "Chargebacks", 7)],
					size: 13,
					subtitle: "Online marketplace seller",
				},
			},
		],
		edges: [
			{
				id: "a-device",
				source: "account-a",
				target: "device",
				attributes: {
					color: palette.coral,
					properties: [property("sessions", "Sessions", 14)],
					relationship: "Signed in from",
				},
			},
			{
				id: "b-device",
				source: "account-b",
				target: "device",
				attributes: {
					color: palette.amber,
					properties: [property("sessions", "Sessions", 3)],
					relationship: "Signed in from",
				},
			},
			{
				id: "a-payment",
				source: "account-a",
				target: "payment",
				attributes: {
					color: palette.coral,
					properties: [property("transactions", "Transactions", 5)],
					relationship: "Paid with",
				},
			},
			{
				id: "b-payment",
				source: "account-b",
				target: "payment",
				attributes: {
					color: palette.amber,
					properties: [property("transactions", "Transactions", 2)],
					relationship: "Paid with",
				},
			},
			{
				id: "payment-merchant",
				source: "payment",
				target: "merchant",
				attributes: {
					color: palette.purple,
					properties: [property("amount", "Total amount", "€4,820")],
					relationship: "Used at",
				},
			},
		],
	},
} satisfies DemoUseCase;

export const demoUseCases = [knowledge, dependencies, investigation] as const satisfies readonly [
	DemoUseCase,
	DemoUseCase,
	DemoUseCase,
];

export function resolveDemoAction(useCase: DemoUseCase, nodeId: string, actionId: string): DemoActionResult {
	const node = useCase.data.nodes.find(({ id }) => id === nodeId);
	if (!node) throw new Error(`Unknown demo node "${nodeId}"`);

	if (actionId === "primary") {
		return { message: node.attributes.primaryActionFeedback, selectedNodeIds: [nodeId] };
	}
	if (actionId === "trace-connections") {
		const neighbors = new Set<string>();
		for (const edge of useCase.data.edges) {
			if (edge.source === nodeId) neighbors.add(edge.target);
			if (edge.target === nodeId) neighbors.add(edge.source);
		}
		return {
			message: `${node.attributes.label} has ${neighbors.size} direct connection${neighbors.size === 1 ? "" : "s"}.`,
			selectedNodeIds: [nodeId, ...[...neighbors].sort()],
		};
	}

	throw new Error(`Unknown demo action "${actionId}"`);
}
