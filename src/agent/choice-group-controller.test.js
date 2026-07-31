const assert = require("node:assert/strict");

const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { AgentController } = require("./controller");

async function main() {
	const browser = await launchChromium();
	try {
		await assertGroupedReviewExpandsToExistingActions(browser);
		await assertExistingReferralCheckboxDefaultIsPreserved(browser);
		await assertUnexpectedExistingSelectionIsNotCleared(browser);
		await assertSensitiveMultipleGroupStillRequiresReview(browser);
	} finally {
		await browser.close();
	}
}

async function assertExistingReferralCheckboxDefaultIsPreserved(browser) {
	const { context, page } = await openPage(browser, createReferralCheckboxPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 10 });
		const result = await controller.runOnPage(page, {});

		assert.equal(await page.getByLabel("Seek", { exact: true }).isChecked(), true);
		assert.equal(await page.getByLabel("LinkedIn", { exact: true }).isChecked(), false);
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertUnexpectedExistingSelectionIsNotCleared(browser) {
	const { context, page } = await openPage(browser, createGroupedApplicationPageUrl({ javaChecked: true }));
	try {
		await waitForPageStable(page);
		const controller = new AgentController({
			maxCycles: 15,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				const item = reviewCheckpoint.items[0];
				return [{ itemId: item.id, action: "select", value: ["React", "AWS"] }];
			},
		});
		const result = await controller.runOnPage(page, { referralSource: "Seek" });

		assert.equal(result.status, "needs-user-confirmation");
		assert.equal(await page.getByLabel("Java", { exact: true }).isChecked(), true);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

async function assertGroupedReviewExpandsToExistingActions(browser) {
	const { context, page } = await openPage(browser, createGroupedApplicationPageUrl());
	try {
		await waitForPageStable(page);
		let reviewCalls = 0;
		const controller = new AgentController({
			maxCycles: 15,
			reviewCheckpointProvider: async ({ reviewCheckpoint }) => {
				reviewCalls += 1;
				assert.equal(reviewCheckpoint.items.length, 1);
				const item = reviewCheckpoint.items[0];
				assert.equal(item.fieldLabel.text, "Technologies used");
				assert.equal(item.metadata.multiple, true);
				assert.deepEqual(item.options.map((option) => option.label), ["React", "AWS", "Java"]);
				return [{ itemId: item.id, action: "select", value: ["React", "AWS"] }];
			},
		});
		const result = await controller.runOnPage(page, { referralSource: "Seek" });

		assert.equal(reviewCalls, 1);
		assert.equal(await page.getByLabel("Seek", { exact: true }).isChecked(), true);
		assert.equal(await page.getByLabel("React", { exact: true }).isChecked(), true);
		assert.equal(await page.getByLabel("AWS", { exact: true }).isChecked(), true);
		assert.equal(await page.getByLabel("Java", { exact: true }).isChecked(), false);
		assert.equal(result.status, "awaiting-human-confirmation");
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
		assert.equal(await page.locator("#submitted").textContent(), "not submitted");
	} finally {
		await context.close();
	}
}

async function assertSensitiveMultipleGroupStillRequiresReview(browser) {
	const { context, page } = await openPage(browser, createWorkEligibilityPageUrl());
	try {
		await waitForPageStable(page);
		const controller = new AgentController({ maxCycles: 5 });
		const result = await controller.runOnPage(page, {
			workAuthorization: "New Zealand Permanent Resident visa",
		});
		assert.equal(result.status, "needs-review");
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items.length, 1);
		assert.equal(result.runtimeState.pendingReviewCheckpoint.items[0].fieldLabel.text, "What is your residency status?");
		assert.equal(await page.getByLabel("New Zealand permanent resident", { exact: true }).isChecked(), false);
		assert.equal(result.runtimeState.finalSubmissionTriggered, false);
	} finally {
		await context.close();
	}
}

function createGroupedApplicationPageUrl(options = {}) {
	const html = [
		"<!doctype html><html><body><form onsubmit=\"event.preventDefault();document.querySelector('#submitted').textContent='submitted'\">",
		"<fieldset><legend>How did you hear about us?</legend>",
		"<label><input type=\"radio\" name=\"source\" value=\"seek\" required>Seek</label>",
		"<label><input type=\"radio\" name=\"source\" value=\"other\">Other</label>",
		"</fieldset>",
		"<fieldset><legend>Technologies used</legend>",
		"<label><input type=\"checkbox\" name=\"technologies[]\" value=\"react\" required>React</label>",
		"<label><input type=\"checkbox\" name=\"technologies[]\" value=\"aws\">AWS</label>",
		`<label><input type="checkbox" name="technologies[]" value="java"${options.javaChecked ? " checked" : ""}>Java</label>`,
		"</fieldset>",
		"<button type=\"submit\">Submit application</button>",
		"</form><div id=\"submitted\">not submitted</div></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

function createWorkEligibilityPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<fieldset><legend>What is your residency status?</legend>",
		"<label><input type=\"checkbox\" name=\"status[]\" value=\"citizen\" required>New Zealand citizen</label>",
		"<label><input type=\"checkbox\" name=\"status[]\" value=\"resident\">New Zealand permanent resident</label>",
		"<label><input type=\"checkbox\" name=\"status[]\" value=\"visa\">Work visa</label>",
		"</fieldset><button type=\"submit\">Submit application</button>",
		"</form></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

function createReferralCheckboxPageUrl() {
	const html = [
		"<!doctype html><html><body><form>",
		"<fieldset><legend>How did you hear about us?</legend>",
		"<label><input type=\"checkbox\" name=\"source[]\" value=\"seek\">Seek</label>",
		"<label><input type=\"checkbox\" name=\"source[]\" value=\"linkedin\">LinkedIn</label>",
		"</fieldset><button type=\"submit\">Submit application</button>",
		"</form></body></html>",
	].join("");
	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
