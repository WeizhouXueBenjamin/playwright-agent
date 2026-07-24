const assert = require("node:assert/strict");

const { normalizeOptionText, resolveOption } = require("./option-resolver");

const workEligibilityContext = {
	fieldIntent: "work-authorization",
	fieldLabel: "Work Eligibility*",
	profileProperty: {
		path: "workAuthorization",
		source: "deterministic-work-eligibility",
	},
	requiresSponsorship: null,
};

assert.equal(normalizeOptionText("  Citizen &  Permanent Resident  "), "citizen and permanent resident");
assert.equal(normalizeOptionText("The University of Auckland"), "university of auckland");
assert.equal(normalizeOptionText("Bachelor's   Degree"), "bachelor's degree");
assert.equal(normalizeOptionText("BACHELOR'S - DEGREE"), "bachelor's degree");

assertMatched(
	resolveOption(
		[{ label: "Citizen or Permanent Resident" }],
		"Citizen or Permanent Resident Visa",
		workEligibilityContext,
	),
	"controlled-equivalence",
	"Citizen or Permanent Resident",
	"work-eligibility-controlled-equivalence",
);

assertMatched(
	resolveOption([{ label: "Citizen & Permanent Resident" }], "Citizen and Permanent Resident"),
	"canonical",
	"Citizen & Permanent Resident",
	"canonical-equality",
);

assertMatched(
	resolveOption([{ label: "New Zealand +64" }], "New Zealand", { fieldLabel: "Country" }),
	"controlled-equivalence",
	"New Zealand +64",
	"structural-controlled-equivalence",
);

assertMatched(
	resolveOption(
		[
			{ label: "Auckland, California, United States" },
			{ label: "Auckland, Auckland Region, New Zealand" },
		],
		"Auckland",
		{ selectionContext: { country: "New Zealand" } },
	),
	"controlled-equivalence",
	"Auckland, Auckland Region, New Zealand",
	"structural-controlled-equivalence",
);

assertMatched(
	resolveOption([{ label: "The University of Auckland" }], "University of Auckland"),
	"canonical",
	"The University of Auckland",
	"canonical-equality",
);

assertNoMatch(resolveOption([{ label: "Computer Science and Engineering" }], "Computer Science"), "below-similarity-threshold");
assertNoMatch(resolveOption([{ label: "65 - 75k" }], "65"), "below-similarity-threshold");
assertReview(resolveOption([{ label: "100 USD" }], "100"), "token-similarity", "token-similarity-review-only");
assertNoMatch(resolveOption([{ label: "New Zealand citizen" }], "New Zealand", { fieldLabel: "Country" }), "below-similarity-threshold");
assertNoMatch(
	resolveOption([{ label: "Auckland, California, United States" }], "Auckland", { selectionContext: { country: "New Zealand" } }),
	"below-similarity-threshold",
);
assertReview(resolveOption([{ label: "Citizen" }], "Citizen or Permanent Resident Visa", workEligibilityContext), "controlled-equivalence", "missing-permanent-resident");
assertReview(resolveOption([{ label: "Temporary Work Visa" }], "Permanent Resident Visa", workEligibilityContext), "controlled-equivalence", "conflicting-status");
assertNoMatch(resolveOption([{ label: "Not currently authorized to work" }], "Authorized to work", workEligibilityContext), "below-similarity-threshold");
assertNoMatch(resolveOption([{ label: "No" }], "Yes"), "no-token-candidates");
assertNoMatch(resolveOption([{ label: "Eligible" }, { label: "Not eligible" }], "Currently eligible"), "below-similarity-threshold");
assertReview(
	resolveOption([{ label: "Work Visa - Sponsorship required" }], "Work Visa", {
		...workEligibilityContext,
		requiresSponsorship: false,
	}),
	"controlled-equivalence",
	"sponsorship-conflict",
);
assertReview(
	resolveOption([{ label: "Citizen or Permanent Resident - conditions apply" }], "Citizen or Permanent Resident Visa", workEligibilityContext),
	"controlled-equivalence",
	"unknown-additional-status",
);
assert.equal(resolveOption([{ label: "Citizen or Permanent Resident", disabled: true }], "Citizen or Permanent Resident Visa", workEligibilityContext).reason, "no-observed-option");
assert.equal(resolveOption([], "Citizen or Permanent Resident Visa", workEligibilityContext).reason, "no-observed-option");

const equalScores = resolveOption([{ label: "Alpha Beta" }, { label: "Alpha Gamma" }], "Alpha Beta Gamma");
assert.equal(equalScores.status, "needs-review");
assert.equal(equalScores.reason, "insufficient-score-margin");

const similarityOnly = resolveOption([{ label: "Citizen Permanent" }], "Citizen Permanent Resident");
assert.equal(similarityOnly.status, "needs-review");
assert.equal(similarityOnly.tier, "token-similarity");
assert.equal(similarityOnly.reason, "token-similarity-review-only");

const multipleControlled = resolveOption(
	[
		{ label: "Citizen or Permanent Resident" },
		{ label: "Citizen and Permanent Resident" },
	],
	"Citizen or Permanent Resident Visa",
	workEligibilityContext,
);
assert.equal(multipleControlled.status, "needs-review");
assert.equal(multipleControlled.reason, "multiple-controlled-equivalence-candidates");

function assertMatched(result, tier, optionLabel, reason) {
	assert.equal(result.status, "matched");
	assert.equal(result.tier, tier);
	assert.equal(result.optionLabel, optionLabel);
	assert.equal(result.reason, reason);
}

function assertReview(result, tier, reason) {
	assert.equal(result.status, "needs-review");
	assert.equal(result.tier, tier);
	assert.equal(result.reason, reason);
}

function assertNoMatch(result, reason) {
	assert.equal(result.status, "no-match");
	assert.equal(result.tier, "none");
	assert.equal(result.reason, reason);
}
