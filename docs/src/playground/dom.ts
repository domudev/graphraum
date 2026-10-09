/** Finds an element the page markup guarantees, failing loudly when the markup and script drift apart. */
export function requireElement<ElementType extends Element = HTMLElement>(
	root: ParentNode,
	selector: string,
): ElementType {
	const element = root.querySelector<ElementType>(selector);
	if (!element) throw new Error(`Playground element not found: ${selector}`);
	return element;
}
