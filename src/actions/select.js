const { resolveFieldLocator } = require("./locator");
const { selectCustomOption } = require("./selection-options");
const { resolveOption } = require("./option-resolver");

async function selectOption(page, step) {
	if (step.field.kind === "radio") {
		const value = String(step.actionValue);
		const radio = page.getByLabel(value, { exact: true });
		if (await radio.count() < 1) {
			throw new Error(`No radio option matched "${value}".`);
		}
		await radio.first().check();
	return {
		action: "select-option",
		locatorStrategy: `radio-label:${value}`,
		selectedOptionLabel: value,
	};
	}

	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	const value = String(step.actionValue);
	const nativeSelect = await locator.evaluate((element) => element.tagName.toLowerCase() === "select");
	const matchContext = buildOptionMatchContext(step);
	if (!nativeSelect) return selectCustomOption(page, step.field, value, step.profileProperty && step.profileProperty.selectionContext, matchContext);
	const option = await findMatchingOption(locator, value, matchContext);

	if (!option) {
		const error = new Error(`No selectable option matched "${value}".`);
		error.optionMatch = await buildNativeOptionMatch(locator, value, matchContext);
		throw error;
	}

	await locator.selectOption(option);

	return {
		action: "select-option",
		locatorStrategy: strategy,
		selectedOptionLabel: option.label,
		selectedOptionValue: option.value,
		selectedOptionId: option.optionId,
	};
}

async function findMatchingOption(locator, value, matchContext = {}) {
	const options = await locator.evaluate((element) => {
		const options = Array.from(element.options || []);
		return options.map((option) => ({
			optionId: option.id || option.value || option.label,
			label: String(option.label || option.textContent || "").trim(),
			value: option.value,
			disabled: option.disabled,
			placeholder: !option.value && /^select(\s|\.|$)/i.test(String(option.label || option.textContent || "").trim()),
		}));
	});
	const result = resolveOption(options, value, matchContext);
	if (result.status !== "matched") return null;
	const match = options.find((option) => option.label === result.optionLabel && !option.disabled);
	if (!match) return null;
	return { value: match.value, label: match.label, optionId: match.optionId };
}

async function buildNativeOptionMatch(locator, value, matchContext = {}) {
	const options = await locator.evaluate((element) => Array.from(element.options || []).map((option) => ({
		label: String(option.label || option.textContent || "").trim(),
		value: option.value,
		disabled: option.disabled,
		placeholder: !option.value && /^select(\s|\.|$)/i.test(String(option.label || option.textContent || "").trim()),
	})));
	const result = resolveOption(options, value, matchContext);
	return {
		status: result.status,
		tier: result.tier,
		reason: result.reason,
		optionLabel: result.optionLabel,
		candidateCount: options.filter((option) => option.label && !option.disabled && !option.placeholder).length,
		candidates: result.candidates || [],
	};
}

function buildOptionMatchContext(step) {
	return {
		fieldIntent: step.safetyDecision && step.safetyDecision.fieldIntent,
		fieldLabel: step.field && step.field.label && step.field.label.text,
		profileProperty: step.profileProperty || {},
		selectionContext: step.profileProperty && step.profileProperty.selectionContext,
		requiresSponsorship: step.profileProperty && step.profileProperty.requiresSponsorship,
	};
}

module.exports = {
	selectOption,
};
