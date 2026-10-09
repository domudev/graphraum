/** Joins a path onto the docs base. Astro's BASE_URL has no trailing slash, for example `/graphraum`. */
export function sitePath(path = "", base: string = import.meta.env.BASE_URL): string {
	return `${base.endsWith("/") ? base : `${base}/`}${path.replace(/^\/+/, "")}`;
}
