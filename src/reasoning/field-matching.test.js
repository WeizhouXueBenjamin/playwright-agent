const assert = require("node:assert/strict");

const { matchFieldsToProfile } = require("./field-matching");

const semanticPage = {
	interactiveElements: [
		createField("interactive-1", "text-input", "First name", "label", 0.98),
		createField("interactive-2", "checkbox", "I agree", "label", 0.98, "checkbox"),
		createField("interactive-3", "selection", "Country", "aria-label", 0.94),
		createField("interactive-4", "button", "Continue", "visible-text", 0.9, "button"),
	],
};

const profile = {
	firstName: "Aroha",
	lastName: "Smith",
	email: "aroha@example.com",
	country: "New Zealand",
	agreement: true,
};

const matches = matchFieldsToProfile(semanticPage, profile);

assert.deepEqual(
	matches.map((match) => ({
		field: match.field.label.text,
		property: match.matchedProfileProperty && match.matchedProfileProperty.path,
		confidence: match.confidenceScore,
	})),
	[
		{ field: "First name", property: "firstName", confidence: 98 },
		{ field: "I agree", property: "agreement", confidence: 90 },
		{ field: "Country", property: "country", confidence: 94 },
	],
);

function createField(id, kind, label, source, confidence, inputType = "") {
	return {
		id,
		kind,
		inputType,
		required: false,
		disabled: false,
		readonly: false,
		label: { text: label, source, confidence },
		labelCandidates: [{ text: label, source, confidence }],
		options: [],
		evidence: { visibleText: kind === "button" ? label : "" },
	};
}
