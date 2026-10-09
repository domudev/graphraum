/** Old documentation routes and where they live now, relative to the docs base. */
export const legacyRedirects = {
	"api-reference": "reference/api/",
	architecture: "reference/architecture/",
	benchmark: "playground/?scene=stress&prove=1",
	demos: "playground/",
	"demos/dependencies": "playground/?scene=software",
	"demos/investigation": "playground/?scene=fraud",
	"demos/knowledge": "playground/?scene=knowledge",
	explore: "playground/?scene=stress",
	"node-edge-presentation": "guide/data-and-visuals/",
	"visual-language": "guide/theme/",
} as const;

export type LegacyRoute = keyof typeof legacyRedirects;

/** Absolute target for a legacy route under the current base, for example `/graphraum/v0.34.0/`. */
export function legacyTarget(route: LegacyRoute, base: string): string {
	const normalizedBase = base.endsWith("/") ? base : `${base}/`;
	return `${normalizedBase}${legacyRedirects[route]}`;
}
