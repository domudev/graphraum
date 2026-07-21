import type { Html, Root } from "mdast";
import { visit } from "unist-util-visit";

function escapeHtml(value: string) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export default function remarkMermaid() {
	return (tree: Root) => {
		visit(tree, "code", (node, index, parent) => {
			if (node.lang !== "mermaid" || index === undefined || !parent) return;
			const diagram: Html = { type: "html", value: `<pre class="mermaid">${escapeHtml(node.value)}</pre>` };
			parent.children.splice(index, 1, diagram);
		});
	};
}
