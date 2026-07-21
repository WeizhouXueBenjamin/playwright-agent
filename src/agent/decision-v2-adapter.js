const { buildBaseDecision } = require("../contracts/decision-v2");
const { classifyFieldIntent } = require("../reasoning/field-answer-safety");
const { factFromProfileProperty } = require("../profile/profile-facts");

function adaptLegacyStepToDecisionV2(input = {}) {
	const step = input.step || {};
	const observationV2 = input.observationV2 || {};
	const field = step.field || {};
	const fact = getStepFact(step, input.semanticOwner || "deterministic-semantic-rule");
	const fieldIntent = step.safetyDecision && step.safetyDecision.fieldIntent
		|| classifyFieldIntent(field).fieldIntent;

	return {
		...buildBaseDecision({
			observationId: observationV2.observationId,
			observationFingerprint: observationV2.observationFingerprint,
			goal: input.goal || observationV2.taskGoal || "",
			semanticOwner: input.semanticOwner || "deterministic-semantic-rule",
		}),
		type: "act",
		targetElementId: field.id,
		interpretedPageGoal: inferPageGoal(step),
		interpretedFieldIntent: fieldIntent,
		evidenceReferences: buildEvidenceReferences(field),
		selectedProfileFactId: fact.factId,
		selectedProfileFact: fact,
		proposedAbstractCapability: step.capability && step.capability.name || step.action || "",
		proposedValue: step.actionValue,
		expectedPostcondition: step.verification && step.verification.expectedState || "",
		uncertainty: {
			level: getUncertaintyLevel(step.confidenceScore),
			confidenceScore: step.confidenceScore,
		},
		alternativesConsidered: [],
		reviewRequirement: {
			required: Boolean(step.safetyDecision && step.safetyDecision.requiresReview),
			reason: step.safetyDecision && step.safetyDecision.reason || "",
		},
		provenance: {
			semanticOwner: input.semanticOwner || "deterministic-semantic-rule",
			approvalOwner: "",
		},
		internalStep: step,
	};
}

function adaptReviewItemToDecisionV2(input = {}) {
	const reviewItem = input.reviewItem || {};
	const observationV2 = input.observationV2 || {};
	return {
		...buildBaseDecision({
			observationId: observationV2.observationId,
			observationFingerprint: observationV2.observationFingerprint,
			goal: input.goal || observationV2.taskGoal || "",
			semanticOwner: input.semanticOwner || "safety-guard",
		}),
		type: "request-review",
		targetElementId: reviewItem.field && reviewItem.field.id || "",
		reason: reviewItem.reason || "",
		reviewItem,
		provenance: {
			semanticOwner: input.semanticOwner || "safety-guard",
			approvalOwner: "safety-guard",
		},
	};
}

function getStepFact(step, semanticOwner) {
	if (step.profileProperty) {
		return factFromProfileProperty({
			...step.profileProperty,
			value: Object.prototype.hasOwnProperty.call(step, "actionValue") ? step.actionValue : step.valuePreview,
		});
	}

	return {
		factId: `fact-browser-action-${step.action || "unknown"}`,
		path: `browserAction.${step.action || "unknown"}`,
		value: Object.prototype.hasOwnProperty.call(step, "actionValue") ? step.actionValue : true,
		valueType: typeof (Object.prototype.hasOwnProperty.call(step, "actionValue") ? step.actionValue : true),
		provenance: semanticOwner,
		explicitness: "derived",
		scope: "current-run",
		freshness: "",
		valuePresent: true,
	};
}

function inferPageGoal(step) {
	if (step.action === "click") return "navigate-or-advance";
	return "complete-field";
}

function buildEvidenceReferences(field = {}) {
	const refs = [];
	if (field.label && field.label.text) refs.push({ type: "label", elementId: field.id, text: field.label.text });
	if (field.placeholder) refs.push({ type: "placeholder", elementId: field.id, text: field.placeholder });
	for (const option of field.options || []) refs.push({ type: "option", elementId: field.id, text: option.label || "" });
	return refs;
}

function getUncertaintyLevel(confidenceScore) {
	if (Number(confidenceScore || 0) >= 90) return "low";
	if (Number(confidenceScore || 0) >= 70) return "medium";
	return "high";
}

module.exports = {
	adaptLegacyStepToDecisionV2,
	adaptReviewItemToDecisionV2,
};
