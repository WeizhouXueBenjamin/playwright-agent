const { resolveCapabilityForField } = require("../capabilities/capability-registry");
const { classifyFieldIntent, evaluateFieldAnswerSafety, validateSensitiveFieldValue } = require("../reasoning/field-answer-safety");
const { evaluateActionTargetPolicy } = require("../policy/policy-engine");

const APPROVED_ACTION = "approved-action";
const REJECTED_DECISION = "rejected-decision";
const REVIEW_ITEM = "review-item";

async function gateStepForCurrentObservation(input = {}) {
	return validateActionProposal({
		action: input.step,
		observation: input.observation,
		runtimeState: input.runtimeState || {},
		semanticOwner: input.semanticOwner || "deterministic-semantic-rule",
	});
}

function validateActionProposal(input = {}) {
	const step = input.action;
	const semanticPage = input.observation && input.observation.semanticPage || {};
	const runtimeState = input.runtimeState || {};
	const semanticOwner = input.semanticOwner || "deterministic-semantic-rule";

	if (!step || !step.field || !step.action) return rejected("missing-action-proposal", step, semanticOwner);

	const target = findTarget(semanticPage, step.field.id);
	if (!target) return rejected("target-element-not-found", step, semanticOwner);
	if (!supportsTargetState(target)) return rejected("target-state-not-actionable", step, semanticOwner, { targetElementId: target.id });

	const resolvedCapability = resolveCapabilityForField(target);
	if (!resolvedCapability || !capabilityMatches(step, resolvedCapability)) {
		return rejected("unsupported-target-capability", step, semanticOwner, { proposed: step.action });
	}

	const policy = evaluateActionTargetPolicy(target);
	if (!policy.allowed) return rejected("policy-blocked-action", step, semanticOwner, { policy }, "policy");

	const profileProperty = step.profileProperty || null;
	if (profileProperty) {
		const safetyTarget = step.choiceGroupField || target;
		const safetyValue = step.choiceGroupField ? step.choiceGroupSelectedValues : step.actionValue;
		const safetyDecision = evaluateFieldAnswerSafety(safetyTarget, {
			...profileProperty,
			value: safetyValue,
		});
		const fieldIntent = classifyFieldIntent(safetyTarget);
		const sensitive = fieldIntent.riskLevel === "high" || fieldIntent.fieldIntent !== "low-risk";

		if (sensitive && !safetyDecision.allowed) {
			return review(safetyDecision.reason, step, semanticOwner, { safetyDecision, field: target });
		}

		const compatibility = profileProperty.reviewAnswer && safetyDecision.valueCompatibility
			? safetyDecision.valueCompatibility
			: validateSensitiveFieldValue({
				intent: fieldIntent.fieldIntent,
				value: safetyValue,
				field: safetyTarget,
			});
		if (sensitive && !compatibility.allowed) {
			return review(compatibility.reason, step, semanticOwner, {
				safetyDecision: { ...safetyDecision, valueCompatibility: compatibility },
				field: target,
			});
		}

		if (isAlreadyCompleted(runtimeState, target, profileProperty)) {
			return rejected("runtime-state-already-completed", step, semanticOwner);
		}
	}

	return {
		type: APPROVED_ACTION,
		reason: "decision-gate-approved",
		decisionId: step.id || "",
		step: {
			...step,
			field: target,
			provenance: {
				...(step.provenance || {}),
				semanticOwner,
				approvalOwner: "decision-gate",
			},
		},
		provenance: {
			semanticOwner,
			approvalOwner: "decision-gate",
		},
		policy,
	};
}

function findTarget(semanticPage, targetElementId) {
	return (semanticPage.interactiveElements || []).find((element) => element.id === targetElementId) || null;
}

function supportsTargetState(target) {
	return !target.disabled && !target.readonly;
}

function capabilityMatches(step, resolvedCapability) {
	return step.action === resolvedCapability.action || step.action === resolvedCapability.name;
}

function isAlreadyCompleted(runtimeState, target, profileProperty) {
	return (runtimeState.completedFields || []).some((field) => {
		return (field.fieldId === target.id && labelsMatch(field.label, target.label))
			|| (field.profilePropertyPath === profileProperty.path && labelsMatch(field.label, target.label));
	});
}

function labelsMatch(left, right) {
	return normalizeLabel(left) && normalizeLabel(left) === normalizeLabel(right);
}

function normalizeLabel(label) {
	if (!label) return "";
	return String(label.text || label || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function rejected(reason, step, semanticOwner, details = {}, approvalOwner = "decision-gate") {
	return {
		type: REJECTED_DECISION,
		reason,
		decisionId: step && step.id || "",
		step,
		provenance: {
			semanticOwner,
			approvalOwner,
		},
		...details,
	};
}

function review(reason, step, semanticOwner, details = {}) {
	return {
		type: REVIEW_ITEM,
		reason,
		decisionId: step && step.id || "",
		step,
		provenance: {
			semanticOwner,
			approvalOwner: "safety-guard",
		},
		...details,
	};
}

module.exports = {
	APPROVED_ACTION,
	REJECTED_DECISION,
	REVIEW_ITEM,
	gateStepForCurrentObservation,
	validateActionProposal,
};
