import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	createReleaseFallback,
	createRootRedirect,
	createVersionManifest,
	docsBasePath,
	injectVersionNavigation,
	parseReleaseTags,
} from "../src/lib/release-archive";

const docsRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(docsRoot, "..");
const outputRoot = join(repositoryRoot, ".pages");
const selectorRoot = join(docsRoot, "versioning");

async function run(command: readonly string[], cwd: string, environment: Record<string, string> = {}) {
	const exitCode = await commandExit(command, cwd, environment, "inherit");
	if (exitCode !== 0) throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
}

async function output(command: readonly string[], cwd: string): Promise<string> {
	const [executable, ...args] = command;
	if (!executable) throw new Error("Cannot run an empty command");
	return new Promise((resolveOutput, reject) => {
		const child = spawn(executable, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (exitCode) => {
			if (exitCode === 0) resolveOutput(stdout);
			else reject(new Error(stderr.trim() || `Command failed (${exitCode}): ${command.join(" ")}`));
		});
	});
}

async function commandExit(
	command: readonly string[],
	cwd: string,
	environment: Record<string, string> = {},
	stdio: "ignore" | "inherit" = "ignore",
): Promise<number> {
	const [executable, ...args] = command;
	if (!executable) throw new Error("Cannot run an empty command");
	return new Promise((resolveExit, reject) => {
		const child = spawn(executable, args, { cwd, env: { ...process.env, ...environment }, stdio });
		child.on("error", reject);
		child.on("close", (exitCode) => resolveExit(exitCode ?? 1));
	});
}

async function releaseHasDocs(version: string): Promise<boolean> {
	return (await commandExit(["git", "cat-file", "-e", `${version}:docs/package.json`], repositoryRoot)) === 0;
}

async function findHtmlFiles(directory: string): Promise<readonly string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	return (
		await Promise.all(
			entries.map((entry) => {
				const path = join(directory, entry.name);
				if (entry.isDirectory()) return findHtmlFiles(path);
				return Promise.resolve(entry.isFile() && entry.name.endsWith(".html") ? [path] : []);
			}),
		)
	).flat();
}

async function injectNavigation(directory: string) {
	for (const path of await findHtmlFiles(directory)) {
		await writeFile(path, injectVersionNavigation(await readFile(path, "utf8")));
	}
}

async function buildRelease(version: string, temporaryRoot: string) {
	const releaseOutput = join(outputRoot, version);
	if (!(await releaseHasDocs(version))) {
		await mkdir(releaseOutput, { recursive: true });
		await writeFile(join(releaseOutput, "index.html"), createReleaseFallback(version));
		return;
	}

	const checkout = join(temporaryRoot, version);
	await run(["git", "worktree", "add", "--detach", checkout, version], repositoryRoot);
	try {
		await run(["bun", "install", "--cwd", "docs", "--frozen-lockfile"], checkout);
		await run(
			["bun", "run", "--cwd", "docs", "build", "--", "--outDir", releaseOutput, "--base", `${docsBasePath}${version}`],
			checkout,
			{ GRAPHRAUM_DOCS_VERSION: version },
		);
		await injectNavigation(releaseOutput);
	} finally {
		await run(["git", "worktree", "remove", "--force", checkout], repositoryRoot);
	}
}

function redirectPath(htmlPath: string): string {
	if (htmlPath === "index.html") return "";
	if (htmlPath.endsWith("/index.html")) return htmlPath.slice(0, -"index.html".length);
	return htmlPath;
}

async function createLatestAliases(latest: string) {
	const latestRoot = join(outputRoot, latest);
	for (const source of await findHtmlFiles(latestRoot)) {
		const htmlPath = relative(latestRoot, source);
		const destination = join(outputRoot, htmlPath);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, createRootRedirect(latest, redirectPath(htmlPath)));
	}
	await writeFile(join(outputRoot, "404.html"), createRootRedirect(latest));
}

async function main() {
	const versions = parseReleaseTags(await output(["git", "tag", "--list", "v*"], repositoryRoot));
	const latest = versions[0];
	if (!latest) throw new Error("No stable Graphraum release tags were found");

	await rm(outputRoot, { force: true, recursive: true });
	await mkdir(outputRoot, { recursive: true });
	const temporaryRoot = await mkdtemp(join(tmpdir(), "graphraum-release-docs-"));
	try {
		for (const version of versions) await buildRelease(version, temporaryRoot);
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
		await run(["git", "worktree", "prune"], repositoryRoot);
	}

	await copyFile(join(selectorRoot, "version-selector.js"), join(outputRoot, "version-selector.js"));
	await copyFile(join(selectorRoot, "version-selector.css"), join(outputRoot, "version-selector.css"));
	await writeFile(join(outputRoot, "versions.json"), createVersionManifest(versions));
	await writeFile(join(outputRoot, ".nojekyll"), "");
	await createLatestAliases(latest);
}

await main();
