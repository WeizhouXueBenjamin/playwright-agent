const assert = require("node:assert/strict");

const { buildFailureReport } = require("./failure-analysis");

const report = buildFailureReport({
	website: "job-boards-greenhouse-io",
	runId: "run-safety",
	executionReport: {
		status: "needs-review",
		verificationResults: [],
		recoveryAttempts: [],
		executionTimeline: [
			{
				decision: {
					type: "needs-review",
					reason: "required-field-needs-review",
					safetyDecision: {
						allowed: false,
						fieldIntent: "salary-expectation",
						riskLevel: "high",
						matchedProperty: "targetRole",
						reason: "sensitive-field-unsafe-profile-match",
						requiresReview: true,
						evidence: [{ source: "label", value: "Salary expectations" }],
					},
				},
			},
		],
	},
});

assert.equal(report.status, "failures-detected");
assert.equal(
	report.failures.some((failure) => failure.rootCause === "Safety guard blocked salary-expectation: sensitive-field-unsafe-profile-match."),
	true,
);
assert.equal(
	report.failures.some((failure) => failure.impact === "The agent correctly avoided guessing a sensitive application answer."),
	true,
);
