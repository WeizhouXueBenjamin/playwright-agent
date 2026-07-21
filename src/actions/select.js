const { resolveFieldLocator } = require("./locator");

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
		};
	}

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
