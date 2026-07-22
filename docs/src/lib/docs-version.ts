export interface GraphraumDocsVersion {
	display: string;
	installCommand: string | null;
	isRelease: boolean;
	referenceUrl: string;
	sourceUrl: string;
}

const repositoryUrl = "https://github.com/domudev/graphraum";
const releasePattern = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;

export function resolveDocsVersion(value?: string): GraphraumDocsVersion {
	const version = value?.trim();
	if (!version) {
		return {
			display: "development",
			installCommand: null,
			isRelease: false,
			referenceUrl: repositoryUrl,
			sourceUrl: `${repositoryUrl}/tree/main`,
		};
	}

	const match = releasePattern.exec(version);
	if (!match?.[1]) throw new Error(`Invalid graphraum docs version: "${version}"`);
	return {
		display: version,
		installCommand: `bun add @domudev/graphraum@${match[1]}`,
		isRelease: true,
		referenceUrl: `${repositoryUrl}/releases/tag/${version}`,
		sourceUrl: `${repositoryUrl}/tree/${version}`,
	};
}

export const graphraumDocsVersion = resolveDocsVersion(import.meta.env.GRAPHRAUM_DOCS_VERSION);
