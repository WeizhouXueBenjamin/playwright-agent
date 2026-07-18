const assert = require("node:assert/strict");

const {
	evaluateActionTargetPolicy,
	evaluateNavigationPolicy,
	evaluatePagePolicy,
	findIrreversibleControl,
} = require("./policy-engine");

const continueButton = {
	id: "continue",
	kind: "button",
	label: { text: "Continue", source: "text", confidence: 1 },
	disabled: false,
};
const submitButton = {
	id: "submit",
	kind: "button",
	label: { text: "Submit application", source: "text", confidence: 1 },
	disabled: false,
};
const paymentButton = {
	id: "pay",
	kind: "button",
	label: { text: "Pay now", source: "text", confidence: 1 },
	disabled: false,
};

assert.deepEqual(
	pickPolicyFields(evaluateNavigationPolicy(continueButton)),
	{
		status: "allowed",
		allowed: true,
		policy: "safe-navigation",
		reason: "safe-navigation-control",
		risk: "low",
	},
);

assert.deepEqual(
	pickPolicyFields(evaluateActionTargetPolicy(submitButton)),
	{
		status: "requires-confirmation",
		allowed: false,
		policy: "stop-before-final-submission",
		reason: "irreversible-action-needs-confirmation",
		risk: "high",
	},
);

assert.deepEqual(
	pickPolicyFields(evaluateActionTargetPolicy(paymentButton)),
	{
		status: "requires-confirmation",
		allowed: false,
		policy: "prevent-irreversible-actions",
		reason: "irreversible-action-needs-confirmation",
		risk: "high",
	},
);

const pagePolicy = evaluatePagePolicy({
	interactiveElements: [continueButton, submitButton],
});

assert.equal(pagePolicy.allowed, false);
assert.equal(pagePolicy.reason, "final-submission-control-detected");
assert.equal(pagePolicy.policy, "stop-before-final-submission");
assert.equal(findIrreversibleControl({ interactiveElements: [continueButton] }), null);

function pickPolicyFields(policyEvaluation) {
	return {
		status: policyEvaluation.status,
		allowed: policyEvaluation.allowed,
		policy: policyEvaluation.policy,
		reason: policyEvaluation.reason,
		risk: policyEvaluation.risk,
	};
}
