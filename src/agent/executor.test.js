const assert = require("node:assert/strict");

const { buildExecutionPlan } = require("./planner");
const { executePlanOnPage } = require("./executor");
const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");

async function main() {
	const browser = await launchChromium();

	try {
		await assertCompletedExecution(browser);
		await assertStopsAfterFailure(browser);
	} finally {
		await browser.close();
	}
}

async function assertCompletedExecution(browser) {
	const { context, page } = await openPage(browser, createTestPageUrl());
	try {
		await waitForPageStable(page);

		const plan = buildExecutionPlan([
			createMatch("interactive-1", "text-input", "First name", "firstName", "Aroha", 98),
			createMatch("interactive-2", "checkbox", "I agree", "agreement", true, 90),
			createMatch("interactive-3", "selection", "Country", "country", "New Zealand", 94),
		]);

		const result = await executePlanOnPage(page, plan);

		assert.equal(result.status, "completed");
		assert.deepEqual(result.results.map((item) => item.verification.ok), [true, true, true]);
		assert.equal(await page.getByLabel("First name").inputValue(), "Aroha");
		assert.equal(await page.getByLabel("I agree").isChecked(), true);
		assert.equal(await page.getByLabel("Country").inputValue(), "New Zealand");
	} finally {
		await context.close();
	}
}

async function assertStopsAfterFailure(browser) {
	const { context, page } = await openPage(browser, createTestPageUrl());
	try {
		await waitForPageStable(page);

		const plan = buildExecutionPlan([
			createMatch("interactive-1", "text-input", "First name", "firstName", "Aroha", 98),
			createMatch("interactive-2", "selection", "Country", "country", "Atlantis", 94),
			createMatch("interactive-3", "checkbox", "I agree", "agreement", true, 90),
		]);

		const result = await executePlanOnPage(page, plan);

		assert.equal(result.status, "rejected");
		assert.equal(result.failedStepId, "step-2");
		assert.equal(result.reason, "unsupported-target-capability");
		assert.equal(result.results.length, 2);
		assert.equal(await page.getByLabel("I agree").isChecked(), false);
	} finally {
		await context.close();
	}
}

function createMatch(fieldId, kind, label, propertyPath, value, confidenceScore) {
	return {
		field: {
			id: fieldId,
			kind,
			label: { text: label, source: "label", confidence: 0.98 },
			labelCandidates: [{ text: label, source: "label", confidence: 0.98 }],
			required: false,
			inputType: kind === "checkbox" ? "checkbox" : "",
			options: kind === "selection" ? [{ label: "New Zealand", valuePresent: true, disabled: false }] : [],
		},
		matchedProfileProperty: {
			path: propertyPath,
			value,
			valueType: typeof value,
			valuePresent: true,
		},
		confidenceScore,
		reasoning: `Matched ${label} to ${propertyPath}.`,
	};
}

function createTestPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" name=\"firstName\">",
		"<label><input type=\"checkbox\" name=\"agree\"> I agree</label>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\" name=\"country\">",
		"<option value=\"\">Select...</option>",
		"<option>New Zealand</option>",
		"</select>",
		"</form>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
