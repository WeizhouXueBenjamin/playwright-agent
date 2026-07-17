const { resolveFieldLocator } = require("./locator");

async function setCheckbox(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	const shouldBeChecked = Boolean(step.actionValue);

	if (shouldBeChecked) {
		await locator.check();
	} else {
		await locator.uncheck();
	}

	return {
		action: "set-checkbox",
		locatorStrategy: strategy,
	};
}

module.exports = {
	setCheckbox,
};
