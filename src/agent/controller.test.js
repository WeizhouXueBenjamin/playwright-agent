const assert = require("node:assert/strict");

const { AgentController } = require("./controller");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");

async function main() {
	const browser = await launchChromium();

	try {
		await assertMultiStepLoop(browser);
		await assertStopsBeforeFinalSubmission(browser);
	} finally {
		await browser.close();
	}
}

async function assertMultiStepLoop(browser) {
	const { context, page } = await openPage(browser, createMultiStepPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			country: "New Zealand",
		});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.getByLabel("Country").inputValue(), "New Zealand");
		assert.equal(result.runtimeState.currentExecutionStatus, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.completedFields.length, 2);
		assert.equal(result.runtimeState.completedActions.length, 3);
		assert.equal(result.runtimeState.detectedFields.some((field) => field.label.text === "Country"), true);
		assert.equal(JSON.stringify(result.runtimeState).includes("confidence"), false);
		assert.equal(JSON.stringify(result.runtimeState).includes("reasoning"), false);

		const actions = result.lifecycle
			.filter((entry) => entry.actionResult)
			.map((entry) => entry.actionResult.step.action);
		assert.deepEqual(actions, ["fill-text", "click", "select-option"]);
	} finally {
		await context.close();
	}
}

async function assertStopsBeforeFinalSubmission(browser) {
	const { context, page } = await openPage(browser, createFinalSubmitPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

function createMultiStepPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<section id=\"step-1\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"button\" id=\"continue\">Continue</button>",
		"</section>",
		"<section id=\"step-2\" hidden>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\">",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"<button type=\"submit\">Submit application</button>",
		"</section>",
		"</form>",
		"<script>",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createFinalSubmitPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<div id=\"submitted\">not submitted</div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
