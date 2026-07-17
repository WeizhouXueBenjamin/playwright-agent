const assert = require("node:assert/strict");

const { AgentController } = require("./controller");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");

async function main() {
	const browser = await launchChromium();

	try {
		await assertMultiStepLoop(browser);
		await assertRecoveryRetriesFailedClick(browser);
		await assertAdaptsThroughCookieBanner(browser);
		await assertStopsOnLoginPage(browser);
		await assertAdvancesUnexpectedIntermediatePage(browser);
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

async function assertAdaptsThroughCookieBanner(browser) {
	const { context, page } = await openPage(browser, createCookieBannerPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(result.lifecycle.some((entry) => entry.decision.reasoning === "Handle cookie-banner."), true);
	} finally {
		await context.close();
	}
}

async function assertStopsOnLoginPage(browser) {
	const { context, page } = await openPage(browser, createLoginPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "login-required");
		assert.equal(result.lifecycle[0].terminalState.details.pageIntent.intent, "login-page");
	} finally {
		await context.close();
	}
}

async function assertAdvancesUnexpectedIntermediatePage(browser) {
	const { context, page } = await openPage(browser, createIntermediatePageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(result.lifecycle.some((entry) => entry.decision.reasoning === "Handle unexpected-intermediate-page."), true);
	} finally {
		await context.close();
	}
}

async function assertRecoveryRetriesFailedClick(browser) {
	const { context, page } = await openPage(browser, createRetryClickPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			country: "New Zealand",
		});

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("Country").inputValue(), "New Zealand");
		assert.equal(result.lifecycle.some((entry) => entry.recovery && entry.recovery.strategy === "retry"), true);
		assert.equal(result.runtimeState.completedActions.some((action) => action.action === "click"), true);
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

function createCookieBannerPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<div id=\"cookie\">We use cookies for privacy. <button type=\"button\">Accept cookies</button></div>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<script>",
		"document.querySelector('#cookie button').addEventListener('click', () => document.querySelector('#cookie').remove());",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createLoginPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"email\">Email</label>",
		"<input id=\"email\" type=\"email\">",
		"<label for=\"password\">Password</label>",
		"<input id=\"password\" type=\"password\">",
		"<button type=\"submit\">Sign in</button>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createIntermediatePageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<section id=\"intro\">",
		"<p>Please review this intermediate page.</p>",
		"<button type=\"button\">Continue</button>",
		"</section>",
		"<form hidden>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<button type=\"submit\">Submit application</button>",
		"</form>",
		"<script>",
		"document.querySelector('#intro button').addEventListener('click', () => {",
		"document.querySelector('#intro').hidden = true;",
		"document.querySelector('form').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createRetryClickPageUrl() {
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
		"let clicks = 0;",
		"document.querySelector('#continue').addEventListener('click', () => {",
		"clicks += 1;",
		"if (clicks < 2) return;",
		"document.querySelector('#step-1').hidden = true;",
		"document.querySelector('#step-2').hidden = false;",
		"});",
		"</script>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
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
