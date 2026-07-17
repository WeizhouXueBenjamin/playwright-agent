const { resolveFieldLocator } = require("./locator");

async function fillText(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	await locator.fill(String(step.actionValue));

	return {
		action: "fill-text",
		locatorStrategy: strategy,
	};
}

module.exports = {
	fillText,
};
