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
			title: "graphraum",
			description: "An opinionated WebGL engine for interactive graphs in 2D and 3D.",
			customCss: ["./src/styles/custom.css"],
			components: {
				Head: "./src/components/Head.astro",
				PageTitle: "./src/components/PageTitle.astro",
				SiteTitle: "./src/components/SiteTitle.astro",
			},
			social: [{ icon: "github", label: "graphraum on GitHub", href: "https://github.com/domudev/graphraum" }],
			sidebar: [
				{
					label: "Start",
					items: [
						{ label: "Overview", link: "/" },
						{ label: "Get started", link: "/get-started/" },
					],
				},
				{
					label: "SDK",
					items: [
						{ label: "Interactive demos", link: "/demos/", badge: "Live" },
						{ label: "Node & edge presentation", link: "/node-edge-presentation/" },
						{ label: "API reference", link: "/api-reference/" },
					],
				},
				{
					label: "Engine",
					items: [
						{ label: "Visual language", link: "/visual-language/" },
						{ label: "Architecture", link: "/architecture/" },
					],
				},
				{
					label: "Evidence",
					items: [{ label: "Live benchmark", link: "/benchmark/", badge: "Proof" }],
				},
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
