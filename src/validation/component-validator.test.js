const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { validateApplicationComponents } = require("./component-validation-runner");
const { validateComponents } = require("./component-validator");

async function main() {
	const directReport = validateComponents(createSemanticPage());
	assert.equal(directReport.coverage.counts["text-input"], 1);
	assert.equal(directReport.coverage.counts["required-field"], 1);
	assert.equal(directReport.coverage.counts["label-association"] >= 7, true);
	assert.equal(directReport.coverage.counts.dropdown, 1);
	assert.equal(directReport.coverage.counts.checkbox, 1);
	assert.equal(directReport.coverage.counts.radio, 1);
	assert.equal(directReport.coverage.counts.upload, 1);
	assert.equal(directReport.coverage.counts["navigation-button"], 1);
	assert.equal(directReport.coverage.counts["validation-message"], 1);
	assert.equal(directReport.unsupportedComponents.length, 1);
	assert.equal(directReport.potentialRisks.some((risk) => risk.type === "unsupported-component"), true);

	const result = await validateApplicationComponents(createValidationPageUrl(), {
		logsDir: "logs/test-component-validation",
	});

	assert.equal(result.report.mode, "component-validation");
	assert.equal(result.report.zeroSideEffects, true);
	assert.equal(result.report.summary.totalDetectedComponents >= 6, true);

	const expectedArtifacts = [
		"component-validation.json",
		"validation-report.json",
		"semantic-page.json",
		"dom-snapshot.html",
		"accessibility-snapshot.json",
		"screenshot.png",
	];

	for (const artifact of expectedArtifacts) {
		const stats = await fs.stat(path.join(result.runDir, artifact));
		assert.equal(stats.size > 0, true, `${artifact} should be non-empty`);
	}

	const html = await fs.readFile(path.join(result.runDir, "dom-snapshot.html"), "utf8");
	assert.equal(html.includes("data-clicked="), false);
}

function createSemanticPage() {
	return {
		url: "https://example.test/apply",
		title: "Application",
		interactiveElements: [
			field("field-1", "text-input", "First name", { required: true, validation: { valid: false, message: "Please fill out this field." } }),
			field("field-2", "selection", "Country", { options: [{ label: "New Zealand" }] }),
			field("field-3", "checkbox", "I agree"),
			field("field-4", "radio", "Yes"),
			field("field-5", "file-upload", "Resume"),
			field("field-6", "button", "Continue"),
			field("field-7", "custom-widget", "Custom date picker"),
		],
	};
}

function field(id, kind, label, overrides = {}) {
	return {
		id,
		kind,
		role: kind === "button" ? "button" : "",
		tagName: kind === "selection" ? "select" : "input",
		inputType: "",
		label: { text: label, source: "label", confidence: 0.98 },
		required: false,
		disabled: false,
		readonly: false,
		options: [],
		validation: { valid: true, message: "" },
		...overrides,
	};
}

function createValidationPageUrl() {
	const html = [
		"<!doctype html>",
		"<html>",
		"<body>",
		"<form>",
		"<label for=\"first\">First name</label>",
		"<input id=\"first\" required>",
		"<label for=\"country\">Country</label>",
		"<select id=\"country\"><option>New Zealand</option></select>",
		"<label><input type=\"checkbox\"> I agree</label>",
		"<fieldset><legend>Authorized to work?</legend><label><input type=\"radio\" name=\"workAuth\"> Yes</label></fieldset>",
		"<label for=\"resume\">Resume</label>",
		"<input id=\"resume\" type=\"file\">",
		"<button type=\"button\" onclick=\"document.body.dataset.clicked = 'clicked'\">Continue</button>",
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
