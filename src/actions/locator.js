async function resolveFieldLocator(page, field) {
	const strategies = buildLocatorStrategies(page, field);

	for (const strategy of strategies) {
		const count = await strategy.locator.count();
		if (count === 1) return { locator: strategy.locator, strategy: strategy.name };
		if (count > 1) return { locator: strategy.locator.first(), strategy: `${strategy.name}:first-of-${count}` };
	}

	throw new Error(`Unable to resolve locator for field "${getFieldName(field)}".`);
}

function buildLocatorStrategies(page, field) {
	const labels = getFieldLabels(field);
	const strategies = [];

	if (field.kind === "button" && field.label && field.label.text) {
		strategies.push({
			name: `button:${field.label.text}`,
			locator: page.getByRole("button", { name: field.label.text, exact: true }),
		});
	}

	if (field.role && field.label && field.label.text) {
		strategies.push({
			name: `role:${field.role}:${field.label.text}`,
			locator: page.getByRole(field.role, { name: field.label.text, exact: true }),
		});
	}

	if (field.kind === "button") {
		return strategies;
	}

	for (const label of labels) {
		strategies.push({
			name: `label:${label}`,
			locator: page.getByLabel(label, { exact: true }),
		});
	}

	for (const label of labels) {
		strategies.push({
			name: `label-fuzzy:${label}`,
			locator: page.getByLabel(label),
		});
	}

	if (field.placeholder) {
		strategies.push({
			name: `placeholder:${field.placeholder}`,
			locator: page.getByPlaceholder(field.placeholder, { exact: true }),
		});
	}

	if (field.kind === "file-upload") {
		strategies.push({
			name: "input:file",
			locator: page.locator("input[type='file']"),
		});
	}

	return strategies;
}

function getFieldLabels(field) {
	const labels = [];
	if (field.label && field.label.text) labels.push(field.label.text);

	for (const candidate of field.labelCandidates || []) {
		if (candidate.text) labels.push(candidate.text);
	}

	return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

function getFieldName(field) {
	return field.label && field.label.text ? field.label.text : field.id;
}

module.exports = {
	resolveFieldLocator,
};
