import { fileURLToPath } from "node:url";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import remarkMermaid from "./src/plugins/remark-mermaid.ts";

const docsThreePath = fileURLToPath(new URL("./node_modules/three", import.meta.url));

export default defineConfig({
	site: "https://domudev.github.io",
	base: "/graphraum",
	integrations: [
		starlight({
			title: "Graphraum",
			description: "An opinionated WebGL engine for interactive graphs in 2D and 3D.",
			customCss: ["./src/styles/custom.css"],
			components: { Head: "./src/components/Head.astro" },
			social: [{ icon: "github", label: "Graphraum on GitHub", href: "https://github.com/domudev/graphraum" }],
			sidebar: [
				{ label: "Overview", link: "/" },
				{ label: "Get started", link: "/get-started/" },
				{ label: "Architecture", link: "/architecture/" },
				{ label: "Live benchmark", link: "/benchmark/", badge: "Proof" },
			],
		}),
	],
	markdown: { remarkPlugins: [remarkMermaid] },
	vite: {
		resolve: {
			alias: {
				"@domudev/graphraum": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
				three: docsThreePath,
			},
		},
	},
});
