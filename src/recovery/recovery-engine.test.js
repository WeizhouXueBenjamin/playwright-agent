const assert = require("node:assert/strict");

const { classifyFailure } = require("./failure-classifier");
const { RetryPolicy } = require("./retry-policy");

const staleFailure = classifyFailure({
	step: createStep("fill-text", "field-1", "First name"),
	actionResult: {
		verification: {
			ok: false,
			error: "Element is not attached to the DOM",
		},
	},
	beforeObservation: createObservation("https://example.test/one", "a"),
	afterObservation: createObservation("https://example.test/one", "a"),
	runtimeState: {
		validationErrors: [],
		remainingRequiredFields: [],
	},
});

assert.equal(staleFailure.type, "stale-element");

const clickFailure = classifyFailure({
	step: createStep("click", "field-2", "Continue"),
	actionResult: {
		verification: {
			ok: false,
			expected: "page-state-changes-after-click",
			actual: "unchanged",
		},
	},
	beforeObservation: createObservation("https://example.test/one", "a"),
	afterObservation: createObservation("https://example.test/one", "a"),
	runtimeState: {
		validationErrors: [],
		remainingRequiredFields: [],
	},
});

assert.equal(clickFailure.type, "failed-click");

const policy = new RetryPolicy({ limits: { "failed-click": 1 } });
assert.equal(policy.canRetry(clickFailure), true);
policy.recordRetry(clickFailure);
assert.equal(policy.canRetry(clickFailure), false);

function createStep(action, fieldId, label) {
	return {
		action,
		field: {
			id: fieldId,
			label: {
				text: label,
				source: "label",
			},
		},
	};
}

function createObservation(url, fingerprint) {
	return {
		fingerprint,
		semanticPage: {
			url,
		},
	};
}
