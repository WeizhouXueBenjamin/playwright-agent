const { resolveFieldLocator } = require("./locator");

async function selectOption(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	const value = String(step.actionValue);
	const option = await findMatchingOption(locator, value);

	if (!option) {
		throw new Error(`No selectable option matched "${value}".`);
	}

	await locator.selectOption(option);

	return {
		action: "select-option",
		locatorStrategy: strategy,
	};
}

async function findMatchingOption(locator, value) {
	return locator.evaluate((element, value) => {
		const options = Array.from(element.options || []);
		const match = options.find((option) => option.label.trim() === value || option.text.trim() === value || option.value === value);
		if (!match || match.disabled) return null;
		return { value: match.value };
	}, value);
}

module.exports = {
	selectOption,
};
