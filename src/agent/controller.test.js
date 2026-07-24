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
		await assertStopsOnUnavailableApplication(browser);
		await assertAdvancesUnexpectedIntermediatePage(browser);
		await assertStopsBeforeFinalSubmission(browser);
		await assertReviewHoldKeepsRunPending(browser);
		await assertGateReviewUsesReviewProvider(browser);
		await assertResumesAfterReviewAnswer(browser);
		await assertSupportsReviewSkip(browser);
		await assertSupportsReviewManual(browser);
		await assertManualFailureReturnsToReview(browser);
		await assertSupportsReviewStop(browser);
	} finally {
		await browser.close();
	}
}

async function assertGateReviewUsesReviewProvider(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			gateStep: async ({ step }) => ({
				type: "review-item",
				reason: "gate-review-required",
				step,
				field: step.field,
				safetyDecision: {
					fieldIntent: "privacy-consent",
					reason: "legal-consent-requires-user-review",
				},
			}),
			reviewAnswerProvider: async () => {
				reviewCalls += 1;
				return { command: "stop" };
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(reviewCalls, 1);
		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(result.reviewPrompt.fieldIntent, "privacy-consent");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertManualFailureReturnsToReview(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async () => {
				reviewCalls += 1;
				if (reviewCalls === 1) return { command: "manual" };
				return { answer: "Yes", resolutionMethod: "user-edited" };
			},
		});
		const result = await controller.runOnPage(page, {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		});

		assert.equal(reviewCalls, 2);
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.lifecycle.some((entry) => entry.phase === "observe-think-review-manual-unverified"), true);
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertReviewHoldKeepsRunPending(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		let resolveReview;
		const reviewStarted = [];
		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async ({ runtimeState }) => {
				reviewStarted.push(runtimeState.currentExecutionStatus);
				return new Promise((resolve) => {
					resolveReview = resolve;
				});
			},
		});
		const runPromise = controller.runOnPage(page, {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		}).catch((error) => ({ __controllerError: error }));

		await waitFor(() => reviewStarted.length > 0, 2000);
		assert.deepEqual(reviewStarted, ["review-pending"]);
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(typeof resolveReview, "function");

		resolveReview({ answer: "Yes" });
		let result;
		result = await runPromise;
		if (result && result.__controllerError) throw result.__controllerError;
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function waitFor(predicate, timeoutMs) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("Timed out waiting for condition.");
}

async function assertStopsOnUnavailableApplication(browser) {
	const { context, page } = await openPage(browser, createUnavailablePageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 5,
			reviewAnswerProvider: async () => {
				throw new Error("Unavailable application must not enter field review.");
			},
		});
		const result = await controller.runOnPage(page, {});

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "application-unavailable");
		assert.equal(result.lifecycle[0].terminalState.details.pageIntent.intent, "application-unavailable");
	} finally {
		await context.close();
	}
}

function createUnavailablePageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<main>",
		"<h1>This job is no longer available</h1>",
		"<p>We are no longer accepting applications for this role.</p>",
		"</main>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

async function assertSupportsReviewStop(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async () => ({ command: "stop" }),
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "needs-review");
		assert.equal(result.reason, "stopped-by-user");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertResumesAfterReviewAnswer(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const answers = [];
		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async ({ reviewPrompt }) => {
				answers.push(reviewPrompt);
				return { answer: "Yes" };
			},
		});
		const profile = {
			firstName: "Aroha",
			workAuthorization: "Open work visa valid until 2027",
		};
		const originalProfile = structuredClone(profile);
		const result = await controller.runOnPage(page, profile);

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(answers.length, 1);
		assert.equal(answers[0].question, "Are you legally authorized to work in New Zealand?");
		assert.deepEqual(answers[0].options, [{ label: "Yes" }, { label: "No" }]);
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(result.runtimeState.reviewAnswers.length, 1);
		assert.equal(result.runtimeState.reviewAnswers[0].source, "explicit-user-review");
		assert.equal(result.runtimeState.reviewAnswers[0].scope, "current-run");
		assert.equal(result.runtimeState.completedFields.some((field) => field.source === "explicit-user-review"), true);
		assert.equal(result.runtimeState.manualReview.length, 1);
		assert.deepEqual(profile, originalProfile);
	} finally {
		await context.close();
	}
}

async function assertSupportsReviewSkip(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async () => ({ command: "skip" }),
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.skippedFields.length, 1);
		assert.equal(result.runtimeState.skippedFields[0].resolutionMethod, "skipped");
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertSupportsReviewManual(browser) {
	const { context, page } = await openPage(browser, createReviewResolutionPageUrl());
	try {
		await waitForPageStable(page);

		const controller = new AgentController({
			maxCycles: 10,
			reviewAnswerProvider: async ({ page: activePage }) => {
				await activePage.getByLabel("Are you legally authorized to work in New Zealand?").selectOption({ label: "Yes" });
				return { command: "manual" };
			},
		});
		const result = await controller.runOnPage(page, { firstName: "Aroha" });

		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.completedFields.some((field) => field.resolutionMethod === "manual"), true);
		assert.equal(await page.getByLabel("Are you legally authorized to work in New Zealand?").inputValue(), "Yes");
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
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
		assert.equal(result.runtimeState.recentActions.length, 3);
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

		const controller = new AgentController({
			maxCycles: 5,
			reviewAnswerProvider: async () => {
				throw new Error("Login page must not enter field review.");
			},
		});
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
		assert.equal(result.lifecycle.some((entry) => entry.recovery && entry.recovery.strategy === "retry-once"), true);
		assert.equal(result.runtimeState.recentActions.some((action) => action.action === "click"), true);
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

function createReviewResolutionPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form onsubmit=\"document.querySelector('#submitted').textContent = 'submitted'; return false;\">",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\" required>",
		"<label for=\"workAuth\">Are you legally authorized to work in New Zealand?</label>",
		"<select id=\"workAuth\" name=\"workAuth\" required>",
		"<option value=\"\">Select...</option>",
		"<option>Yes</option>",
		"<option>No</option>",
		"</select>",
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
