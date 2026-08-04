interface InputOptions {
	checked?: boolean;
	max?: number;
	min?: number;
	name: string;
	step?: number;
	type: "checkbox" | "color" | "number" | "range";
	value?: number | string;
}

interface SelectOption {
	label: string;
	value: string;
}

export function Input({ checked, max, min, name, step, type, value }: InputOptions) {
	const input = document.createElement("input");
	input.className = `control control--${type}`;
	input.name = name;
	input.type = type;
	if (checked !== undefined) input.checked = checked;
	if (max !== undefined) input.max = String(max);
	if (min !== undefined) input.min = String(min);
	if (step !== undefined) input.step = String(step);
	if (value !== undefined) input.value = String(value);
	return input;
}

export function Select(name: string, value: string, options: readonly SelectOption[]) {
	const select = document.createElement("select");
	select.className = "control control--select";
	select.name = name;
	select.append(
		...options.map(({ label, value: optionValue }) => {
			const option = document.createElement("option");
			option.textContent = label;
			option.value = optionValue;
			option.selected = optionValue === value;
			return option;
		}),
	);
	return select;
}

export function Field(label: string, ...controls: HTMLElement[]) {
	const field = document.createElement("label");
	field.className = "field";
	field.append(label, ...controls);
	return field;
}

export function Checkbox(label: string, name: string, checked = false) {
	const field = Field(label, Input({ checked, name, type: "checkbox" }));
	field.classList.add("field--checkbox");
	return field;
}

export function Slider(label: string, name: string, value: number, min: number, max: number, step: number) {
	return Field(label, Input({ max, min, name, step, type: "range", value }));
}

export function Color(label: string, name: string, value: string) {
	return Field(label, Input({ name, type: "color", value }));
}

export function Section(title: string, ...fields: HTMLElement[]) {
	const section = document.createElement("fieldset");
	section.className = "control-section";
	const legend = document.createElement("legend");
	legend.className = "control-section__title";
	legend.textContent = title;
	section.append(legend, ...fields);
	return section;
}

export function renderDataList(element: HTMLElement, entries: ReadonlyArray<readonly [string, string | number]>) {
	element.replaceChildren(
		...entries.flatMap(([label, value]) => {
			const term = document.createElement("dt");
			term.textContent = label;
			const description = document.createElement("dd");
			description.textContent = String(value);
			return [term, description];
		}),
	);
}
