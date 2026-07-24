const assert = require("node:assert/strict");

const { buildReviewCheckpoint } = require("./review-checkpoint");
const { buildFieldFingerprint } = require("./review-resolution");

function main() {
	const checkpoint = buildReviewCheckpoint({
		pageUrl: "https://example.test/apply",
		pageTitle: "Apply",
		reviewItems: [
			{
				field: field({
					id: "privacy",
					label: "Recruitment Privacy Policy",
					kind: "checkbox",
					required: true,
				}),
				safetyDecision: {
					fieldIntent: "privacy-consent",
					riskLevel: "high",
					reason: "legal-consent-requires-user-review",
					requiresReview: true,
				},
				reason: "legal-consent-requires-user-review",
			},
			{
				field: field({
					id: "salary",
					label: "Expected salary",
					kind: "text-input",
					required: true,
				}),
				safetyDecision: {
					fieldIntent: "salary-expectation",
					riskLevel: "high",
					reason: "salary-expectation-requires-explicit-answer",
					requiresReview: true,
				},
				reason: "salary-expectation-requires-explicit-answer",
			},
		],
	});

	assert.equal(checkpoint.status, "waiting-for-user");
	assert.equal(checkpoint.items.length, 2);
	assert.equal(checkpoint.items[0].type, "consent-authorization");
	assert.deepEqual(checkpoint.items[0].allowedActions, ["authorize", "manual", "decline", "stop"]);
	assert.equal(checkpoint.items[1].type, "manual-value-required");
	assert.deepEqual(checkpoint.items[1].allowedActions, ["provide-value", "manual", "skip", "stop"]);
	assert.equal(JSON.stringify(checkpoint).includes("submit"), false);

	const customConsentWithoutOptions = buildReviewCheckpoint({
		reviewItems: [{
			field: {
				...field({ id: "privacy-select", label: "Privacy Policy", kind: "selection", required: true }),
				role: "combobox",
				domId: "privacy-select",
			},
			safetyDecision: {
				fieldIntent: "privacy-consent",
				riskLevel: "high",
				reason: "legal-consent-requires-user-review",
				requiresReview: true,
			},
		}],
	});
	assert.deepEqual(customConsentWithoutOptions.items[0].allowedActions, ["manual", "decline", "stop"]);

	const collapsed = {
		...field({ id: "interactive-4", label: "Privacy Policy", kind: "selection", required: true }),
		role: "combobox",
		domId: "privacy-select",
		options: [],
	};
	const expanded = {
		...collapsed,
		id: "interactive-9",
		options: [{ label: "Acknowledge/Confirm" }],
	};
	assert.equal(buildFieldFingerprint(collapsed), buildFieldFingerprint(expanded));
}

function field(input) {
	return {
		id: input.id,
		kind: input.kind,
		label: { text: input.label, source: "label", confidence: 0.98 },
		labelCandidates: [{ text: input.label, source: "label", confidence: 0.98 }],
		required: input.required,
		inputType: "",
		placeholder: "",
		state: input.kind === "checkbox" ? { checked: false } : { value: "" },
		options: [],
		constraints: {},
		evidence: {},
	};
}

try {
	main();
} catch (error) {
	console.error(error);
	process.exitCode = 1;
}
