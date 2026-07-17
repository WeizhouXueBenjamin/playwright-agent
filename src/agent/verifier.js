const { resolveFieldLocator } = require("../actions/locator");

async function verifyAction(page, step) {
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
		const actual = await locator.inputValue();
		const expected = String(step.actionValue);
		const matched = actual === expected || await selectedOptionTextMatches(locator, expected);
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

async function selectedOptionTextMatches(locator, expected) {
	return locator.evaluate((element, expected) => {
		const selected = element.options[element.selectedIndex];
		return selected ? selected.text.trim() === expected : false;
	}, expected);
}

function buildVerificationResult(ok, expected, actual, locatorStrategy) {
	return {
		ok,
		expected,
		actual,
		locatorStrategy,
	};
}

module.exports = {
	verifyAction,
};
