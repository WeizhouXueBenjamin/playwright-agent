const { resolveFieldLocator } = require("./locator");

async function clickElement(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	await locator.click();

	return {
		action: "click",
		locatorStrategy: strategy,
	};
}

module.exports = {
	clickElement,
};
