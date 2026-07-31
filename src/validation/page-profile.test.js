const assert = require("node:assert/strict");

const { buildApplicableComponents, buildApplicableCoverage } = require("./applicable-components");
const { validateComponents } = require("./component-validator");
const { buildPageProfile } = require("./page-profile");

const entryPage = {
	url: "https://example.test/jobs/details/123",
	title: "Systems Support Technician",
	interactiveElements: [
		link("browse", "Browse Jobs"),
		link("apply", "APPLY NOW"),
	],
};

const entryProfile = buildPageProfile(entryPage);
assert.equal(entryProfile.type, "application-entry");
assert.equal(entryProfile.signals.applicationEntryCount, 1);

const entryValidation = validateComponents(entryPage);
assert.equal(entryValidation.coverage.legacyCoverageRatio, entryValidation.coverage.coverageRatio);
assert.equal(entryValidation.coverage.applicableCoverageRatio, 1);
assert.deepEqual(entryValidation.applicableComponents.required, ["application-entry-link", "label-association"]);
assert.equal(entryValidation.missingComponents.some((component) => component.type === "upload"), true);
assert.equal(entryValidation.coverage.missingRequiredApplicableComponents.length, 0);

const formPage = {
	url: "https://example.test/apply",
	title: "Application",
	interactiveElements: [
		field("first", "text-input", "First name", { required: true }),
		field("resume", "file-upload", "Resume", { required: true }),
		field("submit", "button", "Submit application"),
	],
};

const formProfile = buildPageProfile(formPage);
const formApplicable = buildApplicableComponents(formProfile);
const formValidation = validateComponents(formPage);
const formApplicableCoverage = buildApplicableCoverage(
	formValidation.detectedComponents,
	formApplicable,
	formValidation.coverage.coverageRatio,
);

assert.equal(formProfile.type, "application-form");
assert.equal(formApplicable.required.includes("text-input"), true);
assert.equal(formApplicableCoverage.legacyCoverageRatio, formValidation.coverage.coverageRatio);
assert.equal(formApplicableCoverage.applicableCoverageRatio, 1);

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

function link(id, label) {
	return {
		id,
		kind: "link",
		role: "link",
		tagName: "a",
		inputType: "",
		label: { text: label, source: "visible-text", confidence: 0.9 },
		required: false,
		disabled: false,
		readonly: false,
		options: [],
		validation: { valid: true, message: "" },
	};
}
