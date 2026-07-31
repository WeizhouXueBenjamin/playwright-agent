const { resolveFieldLocator } = require("./locator");

async function setCheckbox(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	const shouldBeChecked = Boolean(step.actionValue);
	const control = await locator.evaluate((element) => ({
		native: element.tagName.toLowerCase() === "input" && ["checkbox", "radio"].includes(String(element.type || "").toLowerCase()),
		checked: "checked" in element ? Boolean(element.checked) : element.getAttribute("aria-checked") === "true",
	}));

	if (control.native) {
		if (shouldBeChecked) await locator.check();
		else await locator.uncheck();
	} else if (control.checked !== shouldBeChecked) {
		await locator.click();
	}

	return {
		action: "set-checkbox",
		locatorStrategy: strategy,
	};
}

module.exports = {
	setCheckbox,
};
