const { resolveFieldLocator } = require("../actions/locator");
const { verifyCustomSelection } = require("../actions/selection-options");
const { buildVerificationResultContract } = require("../contracts/verification-result");

async function verifyAction(page, step, actionResult = {}) {
	if (step.action === "click") {
		return buildVerificationResult(true, "click-dispatched", "click-dispatched", "action-result");
	}

	const { locator, strategy } = await resolveFieldLocator(page, step.field);

	if (step.action === "set-checkbox") {
		const actual = await locator.isChecked();
		const expected = Boolean(step.actionValue);
		return buildVerificationResult(actual === expected, expected, actual, strategy);
	}

	if (step.action === "select-option") {
		if (step.field.kind === "radio") {
			const expected = String(step.actionValue);
			const radio = page.getByLabel(expected, { exact: true });
			const actual = await radio.first().isChecked();
			return buildVerificationResult(actual === true, expected, actual ? expected : "", `radio-label:${expected}`);
		}

		const expected = String(step.actionValue);
		const nativeSelect = await locator.evaluate((element) => element.tagName.toLowerCase() === "select");
		if (!nativeSelect) {
			const custom = await verifyCustomSelection(
				locator,
				actionResult.selectedOptionLabel || "",
				actionResult.selectedOptionValue || "",
			);
			return buildVerificationResult(custom.matched, expected, custom.actual, strategy);
		}
		const actual = await readNativeSelectedOption(locator);
		const matched = exactNativeSelectionMatches(actual, actionResult);
		return buildVerificationResult(matched, expected, actual, strategy);
	}

	if (step.action === "upload-file") {
		const actual = await locator.evaluate((element) => Array.from(element.files || []).map((file) => ({
			name: file.name,
			size: file.size,
		})));
		const expected = String(step.actionValue).split(/[\\/]/).pop();
		const matched = actual.some((file) => file.name === expected);
		return buildVerificationResult(matched, expected, actual, strategy);
	}

	const actual = await locator.inputValue();
	const expected = String(step.actionValue);
	return buildVerificationResult(actual === expected, expected, actual, strategy);
}

async function readNativeSelectedOption(locator) {
	return locator.evaluate((element) => {
		const selected = element.options[element.selectedIndex];
		if (!selected) return { value: "", label: "", optionId: "" };
		return {
			value: selected.value,
			label: String(selected.label || selected.textContent || "").trim(),
			optionId: selected.id || selected.value || selected.label,
		};
	});
}

function exactNativeSelectionMatches(actual, actionResult) {
	if (!actual || !actionResult) return false;
	if (actionResult.selectedOptionValue !== undefined && actual.value !== actionResult.selectedOptionValue) return false;
	if (actionResult.selectedOptionLabel !== undefined && actual.label !== actionResult.selectedOptionLabel) return false;
	if (actionResult.selectedOptionId !== undefined && actionResult.selectedOptionId && actual.optionId !== actionResult.selectedOptionId) return false;
	return Boolean(actionResult.selectedOptionValue !== undefined || actionResult.selectedOptionLabel !== undefined);
}

function buildVerificationResult(ok, expected, actual, locatorStrategy) {
	return buildVerificationResultContract({
		ok,
		expected,
		actual,
		locatorStrategy,
	});
}

module.exports = {
	verifyAction,
};
