function buildSemanticPage(rawPage) {
	const interactiveElements = rawPage.interactiveElements.elements.map(buildSemanticElement);
	const forms = rawPage.interactiveElements.forms.map((form) => ({
		id: form.id,
		label: form.label || form.ariaLabel || form.name || "",
		method: form.method,
		actionPresent: Boolean(form.action),
		controls: form.controlIndexes
			.map((index) => interactiveElements[index])
			.filter(Boolean)
			.map((element) => element.id),
	}));

	return {
		schemaVersion: 1,
		url: rawPage.url,
		title: rawPage.title,
		visibleText: rawPage.visibleText || "",
		summary: summarize(interactiveElements, forms),
		interactiveElements,
		forms,
	};
}

function buildSemanticElement(element) {
	const label = chooseBestLabel(element.labels);

	return {
		id: element.id,
		kind: element.kind,
		role: element.role,
		tagName: element.tagName,
		inputType: element.type,
		label,
		labelCandidates: element.labels,
		placeholder: element.placeholder,
		required: element.required,
		disabled: element.disabled,
		readonly: element.readonly,
		state: element.state || {},
		validation: element.validation || { valid: true, message: "" },
		options: element.options,
		bounds: element.bounds,
		semanticPath: element.semanticPath,
		evidence: {
			namePresent: Boolean(element.name),
			idPresent: Boolean(element.idAttribute),
			ariaLabelPresent: Boolean(element.ariaLabel),
			ariaLabelledByPresent: Boolean(element.ariaLabelledBy),
			visibleText: element.text,
		},
	};
}

function chooseBestLabel(candidates) {
	if (!candidates.length) {
		return {
			text: "",
			source: "none",
			confidence: 0,
		};
	}

	return [...candidates].sort((left, right) => right.confidence - left.confidence)[0];
}

function summarize(elements, forms) {
	const byKind = elements.reduce((summary, element) => {
		summary[element.kind] = (summary[element.kind] || 0) + 1;
		return summary;
	}, {});

	return {
		interactiveElementCount: elements.length,
		formCount: forms.length,
		requiredElementCount: elements.filter((element) => element.required).length,
		unlabelledElementCount: elements.filter((element) => !element.label.text).length,
		byKind,
	};
}

module.exports = {
	buildSemanticPage,
};
