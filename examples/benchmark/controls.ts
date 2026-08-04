import { Checkbox, Color, Field, Input, Section, Select, Slider } from "./ui";

const shapes = [
	{ label: "Circle", value: "circle" },
	{ label: "Square", value: "square" },
	{ label: "Diamond", value: "diamond" },
];

function NumberField(label: string, name: string, value: number, min: number, max?: number, step?: number) {
	return Field(label, Input({ max, min, name, step, type: "number", value }));
}

function SelectField(label: string, name: string, value: string, options: readonly { label: string; value: string }[]) {
	return Field(label, Select(name, value, options));
}

function VisualField(label: string, shapeName: string, shape: string, colorName: string, color: string) {
	const field = document.createElement("div");
	field.className = "field field--visual";
	const name = document.createElement("span");
	name.textContent = label;
	const colorInput = Input({ name: colorName, type: "color", value: color });
	colorInput.ariaLabel = `${label} color`;
	field.append(name, Select(shapeName, shape, shapes), colorInput);
	return field;
}

export function renderControls(form: HTMLFormElement) {
	form.replaceChildren(
		Section(
			"Renderer",
			SelectField("Mode", "mode", "2d", [
				{ label: "2D", value: "2d" },
				{ label: "3D", value: "3d" },
			]),
			Checkbox("Antialias", "antialias"),
			NumberField("Pixel ratio", "maxPixelRatio", 2, 0.5, 4, 0.5),
		),
		Section(
			"Graph",
			SelectField("Fixture", "fixture", "1000", [
				{ label: "100 nodes", value: "100" },
				{ label: "1,000 nodes", value: "1000" },
				{ label: "10,000 nodes", value: "10000" },
				{ label: "100,000 nodes", value: "100000" },
				{ label: "1M density LOD", value: "million-density" },
				{ label: "1M literal nodes", value: "million-literal" },
			]),
			SelectField("Encoding", "encoding", "mapper", [
				{ label: "Typed mapper", value: "mapper" },
				{ label: "Direct snapshot", value: "snapshot" },
			]),
			SelectField("Layout", "layout", "grid", [
				{ label: "Grid", value: "grid" },
				{ label: "Progressive circle", value: "circle" },
				{ label: "ForceAtlas2 worker", value: "forceatlas2" },
				{ label: "Custom force worker", value: "force-custom" },
			]),
		),
		Section(
			"Appearance",
			Slider("Base size", "nodeSize", 3, 1, 12, 0.5),
			Slider("Score scale", "scoreSize", 4, 0, 10, 0.5),
			VisualField("Concept", "conceptShape", "diamond", "conceptColor", "#e4a853"),
			VisualField("Document", "documentShape", "square", "documentColor", "#73c7a5"),
			VisualField("Person", "personShape", "circle", "personColor", "#fcfffc"),
			Color("Mentions edge", "mentionsColor", "#2d8b6a"),
			Color("Related edge", "relatedColor", "#226f54"),
		),
	);
}
