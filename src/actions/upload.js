const { resolveFieldLocator } = require("./locator");

async function uploadFile(page, step) {
	const { locator, strategy } = await resolveFieldLocator(page, step.field);
	await locator.setInputFiles(String(step.actionValue));

	return {
		action: "upload-file",
		locatorStrategy: strategy,
	};
}

module.exports = {
	uploadFile,
};
