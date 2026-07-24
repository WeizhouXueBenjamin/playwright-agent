const assert = require("node:assert/strict");

const { launchChromium } = require("../browser/browser");
const { openPage } = require("../browser/page");
const { waitForPageStable } = require("../browser/stability");
const { verifyAction } = require("./verifier");

async function main() {
	const browser = await launchChromium();

	try {
		await assertNativeExactSelectionVerifies(browser);
		await assertNativePrefixMismatchFails(browser);
		await assertNativeSimilarityMismatchFails(browser);
		await assertCustomExactSelectionVerifies(browser);
		await assertCustomDialCodeDisplayVerifiesAgainstClickedOption(browser);
		await assertCustomPrefixMismatchFails(browser);
	} finally {
		await browser.close();
	}
}

async function assertNativeExactSelectionVerifies(browser) {
	const { context, page } = await openPage(browser, createNativeSelectPageUrl());
	try {
		await waitForPageStable(page);
		await page.getByLabel("Country").selectOption("+64");
		const verification = await verifyAction(page, selectionStep("country", "Country", "New Zealand"), {
			selectedOptionLabel: "New Zealand +64",
			selectedOptionValue: "+64",
			selectedOptionId: "+64",
		});
		assert.equal(verification.ok, true);
	} finally {
		await context.close();
	}
}

async function assertNativePrefixMismatchFails(browser) {
	const { context, page } = await openPage(browser, createNativeSelectPageUrl());
	try {
		await waitForPageStable(page);
		await page.getByLabel("Country").selectOption("nz-citizen");
		const verification = await verifyAction(page, selectionStep("country", "Country", "New Zealand"), {
			selectedOptionLabel: "New Zealand +64",
			selectedOptionValue: "+64",
			selectedOptionId: "+64",
		});
		assert.equal(verification.ok, false);
	} finally {
		await context.close();
	}
}

async function assertNativeSimilarityMismatchFails(browser) {
	const { context, page } = await openPage(browser, createNativeSelectPageUrl());
	try {
		await waitForPageStable(page);
		await page.getByLabel("Country").selectOption("citizen-permanent");
		const verification = await verifyAction(page, selectionStep("country", "Country", "Citizen Permanent Resident"), {
			selectedOptionLabel: "Citizen Permanent Resident",
			selectedOptionValue: "resident",
			selectedOptionId: "resident",
		});
		assert.equal(verification.ok, false);
	} finally {
		await context.close();
	}
}

async function assertCustomExactSelectionVerifies(browser) {
	const { context, page } = await openPage(browser, createCustomSelectPageUrl("Citizen or Permanent Resident", "Work Eligibility"));
	try {
		await waitForPageStable(page);
		const verification = await verifyAction(page, selectionStep("custom", "Work Eligibility", "Citizen or Permanent Resident Visa"), {
			selectedOptionLabel: "Citizen or Permanent Resident",
		});
		assert.equal(verification.ok, true);
	} finally {
		await context.close();
	}
}

async function assertCustomDialCodeDisplayVerifiesAgainstClickedOption(browser) {
	const { context, page } = await openPage(browser, createCustomSelectPageUrl("+64"));
	try {
		await waitForPageStable(page);
		const verification = await verifyAction(page, selectionStep("custom", "Country", "New Zealand"), {
			selectedOptionLabel: "New Zealand +64",
		});
		assert.equal(verification.ok, true);
	} finally {
		await context.close();
	}
}

async function assertCustomPrefixMismatchFails(browser) {
	const { context, page } = await openPage(browser, createCustomSelectPageUrl("New Zealand citizen"));
	try {
		await waitForPageStable(page);
		const verification = await verifyAction(page, selectionStep("custom", "Country", "New Zealand"), {
			selectedOptionLabel: "New Zealand +64",
		});
		assert.equal(verification.ok, false);
	} finally {
		await context.close();
	}
}

function selectionStep(fieldId, label, value) {
	return {
		action: "select-option",
		actionValue: value,
		field: {
			id: fieldId,
			kind: "selection",
			label: { text: label, source: "label", confidence: 1 },
		},
	};
}

function createNativeSelectPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\">",
		"<option value=\"\">Select...</option>",
		"<option value=\"+64\">New Zealand +64</option>",
		"<option value=\"nz-citizen\">New Zealand citizen</option>",
		"<option value=\"citizen-permanent\">Citizen Permanent</option>",
		"</select>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

function createCustomSelectPageUrl(selectedText, label = "Country") {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		`<label id="custom-label" for="custom">${label}</label>`,
		"<div><div id=\"selected-value\">",
		selectedText,
		"</div><div><input id=\"custom\" role=\"combobox\" aria-labelledby=\"custom-label\"></div></div>",
		"</body>",
		"</html>",
	].join("");

	return `data:text/html,${encodeURIComponent(html)}`;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
