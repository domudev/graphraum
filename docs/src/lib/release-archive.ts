export const docsBasePath = "/graphraum/";

const releaseTagPattern = /^v(\d+)\.(\d+)\.(\d+)$/;
const fullGitRevisionPattern = /^[0-9a-f]{40,64}$/;
const navigationMarker = "graphraum-version-navigation";

export function parseReleaseTags(output: string): readonly string[] {
	return output
		.split("\n")
		.map((tag) => ({ match: releaseTagPattern.exec(tag.trim()), tag: tag.trim() }))
		.filter((entry): entry is { match: RegExpExecArray; tag: string } => entry.match !== null)
		.sort((left, right) => {
			for (const index of [1, 2, 3]) {
				const difference = Number(right.match[index]) - Number(left.match[index]);
				if (difference !== 0) return difference;
			}
			return 0;
		})
		.map(({ tag }) => tag);
}

export function injectVersionNavigation(html: string): string {
	if (html.includes(`data-${navigationMarker}`)) return html;
	return html
		.replace(
			"</head>",
			`<link data-${navigationMarker} rel="stylesheet" href="${docsBasePath}version-selector.css"></head>`,
		)
		.replace(
			"</body>",
			`<script data-${navigationMarker} src="${docsBasePath}version-selector.js" defer></script></body>`,
		);
}

export function createRootRedirect(version: string, relativePath = ""): string {
	const path = relativePath.replace(/^\/+/, "");
	if (path.split("/").includes("..")) throw new Error(`Unsafe documentation redirect path: "${relativePath}"`);
	const target = `${docsBasePath}${version}/${path}`;
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${target}">
    <link rel="canonical" href="${target}">
    <title>graphraum ${version}</title>
  </head>
  <body>
    <p>Opening <a href="${target}">graphraum ${version} documentation</a>…</p>
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </body>
</html>`;
}

export function createVersionManifest(versions: readonly string[], nextRevision: string): string {
	const latest = versions[0];
	if (!latest) throw new Error("Cannot create a documentation manifest without releases");
	if (!fullGitRevisionPattern.test(nextRevision)) {
		throw new Error("Next documentation requires a full Git revision");
	}
	return JSON.stringify(
		{
			latest,
			versions: [
				{
					href: `${docsBasePath}next/`,
					releaseNotes: `https://github.com/domudev/graphraum/compare/${latest}...${nextRevision}`,
					version: "next",
				},
				...versions.map((version) => ({
					href: `${docsBasePath}${version}/`,
					releaseNotes: `https://github.com/domudev/graphraum/releases/tag/${version}`,
					version,
				})),
			],
		},
		null,
		2,
	);
}

export function createReleaseFallback(version: string): string {
	const releaseUrl = `https://github.com/domudev/graphraum/releases/tag/${version}`;
	const sourceUrl = `https://github.com/domudev/graphraum/tree/${version}`;
	return injectVersionNavigation(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>graphraum ${version}</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { background: #fcfffc; color: #040f0f; margin: 0; }
      header { align-items: center; border-bottom: 1px solid #cad9d1; display: flex; min-height: 4rem; padding: 0 1.25rem; }
      .site-title { color: inherit; font-size: 1.2rem; font-weight: 800; text-decoration: none; }
      main { margin: 10vh auto; max-width: 48rem; padding: 1.25rem; }
      article { border: 1px solid #cad9d1; border-radius: .8rem; overflow: hidden; }
      article > * { margin: 0; padding: 1.25rem; }
      article > * + * { border-top: 1px solid #cad9d1; }
      h1 { font-size: clamp(2.5rem, 8vw, 5rem); letter-spacing: -.06em; }
      nav { display: grid; grid-template-columns: 1fr 1fr; padding: 0; }
      nav a { color: #226f54; font-weight: 700; padding: 1.25rem; text-decoration: none; }
      nav a + a { border-left: 1px solid #cad9d1; }
      @media (prefers-color-scheme: dark) { body { background: #040f0f; color: #fcfffc; } article, header, nav a + a { border-color: #26473d; } }
    </style>
  </head>
  <body>
    <header><a class="site-title" href="${docsBasePath}${version}/">graphraum</a></header>
    <main>
      <article>
        <h1>${version}</h1>
        <p><strong>Documentation was not shipped with this release.</strong> The SDK remains available through its immutable tag and package release.</p>
        <nav><a href="${releaseUrl}">What changed →</a><a href="${sourceUrl}">Browse SDK source →</a></nav>
      </article>
    </main>
  </body>
</html>`);
}
