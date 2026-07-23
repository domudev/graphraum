const docsBasePath = "/graphraum/";

function currentVersion(versions) {
	const segment = window.location.pathname.slice(docsBasePath.length).split("/")[0];
	return versions.find(({ version }) => version === segment);
}

function currentPagePath(version) {
	const path = window.location.pathname.slice(docsBasePath.length);
	return path.startsWith(`${version}/`) ? path.slice(version.length + 1) : "";
}

async function navigateToVersion(version, current) {
	const relativePath = currentPagePath(current.version);
	const samePage = `${version.href}${relativePath}`;
	const response = await fetch(samePage, { method: "HEAD" });
	window.location.assign(response.ok ? samePage : version.href);
}

function createVersionNavigation(manifest) {
	const current =
		currentVersion(manifest.versions) ?? manifest.versions.find(({ version }) => version === manifest.latest);
	if (!current) return;

	const mount = document.querySelector(".versioned-site-title") ?? document.querySelector(".site-title")?.parentElement;
	if (!mount || mount.querySelector(".graphraum-version-nav")) return;
	mount.querySelector('[aria-label^="Documentation for"]')?.remove();

	const navigation = document.createElement("div");
	navigation.className = "graphraum-version-nav";
	const label = document.createElement("label");
	label.className = "graphraum-version-label";
	const labelText = document.createElement("span");
	labelText.textContent = "Docs";
	const select = document.createElement("select");
	select.setAttribute("aria-label", "Documentation version");
	const visibleVersions = new Set(["next", ...manifest.selectorVersions, current.version]);
	for (const version of manifest.versions.filter(({ version }) => visibleVersions.has(version))) {
		const option = document.createElement("option");
		option.selected = version.version === current.version;
		option.textContent =
			version.version === manifest.latest
				? `${version.version} · latest`
				: version.version === "next"
					? "next · development"
					: version.version;
		option.value = version.version;
		select.append(option);
	}
	const archiveOption = document.createElement("option");
	archiveOption.textContent = "Show more…";
	archiveOption.value = "__archive";
	select.append(archiveOption);
	select.addEventListener("change", () => {
		if (select.value === archiveOption.value) {
			window.location.assign(manifest.archiveHref);
			return;
		}
		const selected = manifest.versions.find(({ version }) => version === select.value);
		if (selected) void navigateToVersion(selected, current);
	});
	label.append(labelText, select);

	const changes = document.createElement("a");
	changes.className = "graphraum-version-changes";
	changes.href = current.releaseNotes;
	changes.textContent = "What changed";
	navigation.append(label, changes);
	mount.append(navigation);
}

async function initializeVersionNavigation() {
	const response = await fetch(`${docsBasePath}versions.json`, { cache: "no-store" });
	if (!response.ok) return;
	createVersionNavigation(await response.json());
}

void initializeVersionNavigation();
