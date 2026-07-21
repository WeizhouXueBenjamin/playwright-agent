const { assertDecisionV2Contract } = require("../contracts/decision-v2");
const { buildObservationV2Contract } = require("../contracts/observation-v2");
const { resolveCapabilityForField } = require("../capabilities/capability-registry");
const { classifyFieldIntent, evaluateFieldAnswerSafety, validateSensitiveFieldValue } = require("../reasoning/field-answer-safety");
const { evaluateActionTargetPolicy } = require("../policy/policy-engine");
const { adaptLegacyStepToDecisionV2 } = require("./decision-v2-adapter");
const { factFromProfileProperty, retrieveRelevantProfileFacts } = require("../profile/profile-facts");

const APPROVED_ACTION = "approved-action";
const REJECTED_DECISION = "rejected-decision";
const REVIEW_ITEM = "review-item";
const ALLOWED_VERIFIERS = new Set([
	"field-value-matches-profile-value",
	"checked-state-matches-profile-value",
	"selected-option-matches-profile-value",
	"uploaded-file-matches-profile-value",
	"page-state-changes-after-click",
]);

async function gateStepForCurrentObservation(input = {}) {
	const observationV2 = buildObservationV2Contract({
		observation: input.observation,
		goal: input.goal || "",
		runtimeState: input.runtimeState || {},
		history: input.history || [],
		policySummary: input.policySummary || {},
		safetySummary: input.safetySummary || {},
	});
	const decision = adaptLegacyStepToDecisionV2({
		step: input.step,
		observationV2,
		goal: input.goal || "",
		semanticOwner: input.semanticOwner || "deterministic-semantic-rule",
	});
	return gateDecisionV2({
		decision,
		observationV2,
		semanticPage: input.observation && input.observation.semanticPage || {},
		runtimeState: input.runtimeState || {},
		profile: input.profile || {},
	});
}

function gateDecisionV2(input = {}) {
	const decision = input.decision;
	const observationV2 = input.observationV2 || {};
	const semanticPage = input.semanticPage || {};
	const runtimeState = input.runtimeState || {};

	try {
		assertDecisionV2Contract(decision);
	} catch (error) {
		return rejected("decision-v2-schema-invalid", decision, { message: error.message });
	}

	if (decision.type !== "act") {
		if (decision.type === "request-review") return review("decision-requested-review", decision);
		return rejected("decision-not-executable", decision);
	}
	if (decision.observationId !== observationV2.observationId || decision.observationFingerprint !== observationV2.observationFingerprint) {
		return rejected("stale-observation-fingerprint", decision);
	}

	const target = findTarget(semanticPage, decision.targetElementId);
	if (!target) return rejected("target-element-not-found", decision);
	if (!supportsTargetState(target)) return rejected("target-state-not-actionable", decision, { targetElementId: target.id });

	const resolvedCapability = resolveCapabilityForField(target);
	if (!capabilityMatches(decision.proposedAbstractCapability, resolvedCapability)) {
		return rejected("unsupported-target-capability", decision, { proposed: decision.proposedAbstractCapability });
	}

	const referencedFact = findReferencedFact(decision, input.profile, target);
	if (!referencedFact) return rejected("profile-fact-not-found", decision);
	if (!factMatches(decision.selectedProfileFact, referencedFact)) {
		return rejected("profile-fact-audit-mismatch", decision);
	}

	const deterministicRisk = classifyFieldIntent(target);
	const aiRisk = decision.reviewRequirement && decision.reviewRequirement.required ? "high" : "low";
	const sensitive = deterministicRisk.riskLevel === "high" || aiRisk === "high" || deterministicRisk.fieldIntent !== "low-risk";
	const matchedProfileProperty = {
		path: referencedFact.path,
		value: decision.proposedValue,
		valueType: referencedFact.valueType,
		valuePresent: referencedFact.valuePresent !== false,
		source: referencedFact.provenance,
		scope: referencedFact.scope,
		reviewAnswer: referencedFact.reviewAnswer,
	};
	const safetyDecision = evaluateFieldAnswerSafety(target, matchedProfileProperty);
	if (sensitive && !safetyDecision.allowed) {
		return review(safetyDecision.reason, decision, { safetyDecision, field: target });
	}

	const compatibility = validateSensitiveFieldValue({
		intent: deterministicRisk.fieldIntent,
		value: decision.proposedValue,
		field: target,
	});
	if (sensitive && !compatibility.allowed) {
		return review(compatibility.reason, decision, { safetyDecision: { ...safetyDecision, valueCompatibility: compatibility }, field: target });
	}

	const policy = evaluateActionTargetPolicy(target);
	if (!policy.allowed) return rejected("policy-blocked-action", decision, { policy });

	if (isAlreadyCompleted(runtimeState, target, referencedFact)) {
		return rejected("runtime-state-already-completed", decision);
	}
	if (!ALLOWED_VERIFIERS.has(decision.expectedPostcondition)) {
		return rejected("unsupported-expected-postcondition", decision);
	}

	return {
		type: APPROVED_ACTION,
		reason: "decision-gate-approved",
		decisionId: decision.decisionId,
		decision,
		step: {
			...(decision.internalStep || {}),
			field: target,
			actionValue: decision.proposedValue,
			provenance: {
				semanticOwner: decision.semanticOwner || decision.provenance && decision.provenance.semanticOwner || "deterministic-semantic-rule",
				approvalOwner: "decision-gate",
			},
		},
		provenance: {
			semanticOwner: decision.semanticOwner || "deterministic-semantic-rule",
			approvalOwner: "decision-gate",
		},
		safetyDecision,
		policy,
	};
}

function findTarget(semanticPage, targetElementId) {
	return (semanticPage.interactiveElements || []).find((element) => element.id === targetElementId) || null;
}

function supportsTargetState(target) {
	return !target.disabled && !target.readonly;
}

function capabilityMatches(proposed, resolvedCapability) {
	if (!resolvedCapability) return false;
	return proposed === resolvedCapability.name || proposed === resolvedCapability.action;
}

function findReferencedFact(decision, profile, target) {
	const retrieval = retrieveRelevantProfileFacts({ profile, field: target, limit: 20 });
	const knownFacts = [...retrieval.facts];
	if (decision.internalStep && decision.internalStep.profileProperty) {
		knownFacts.push(factFromProfileProperty({
			...decision.internalStep.profileProperty,
			value: Object.prototype.hasOwnProperty.call(decision.internalStep, "actionValue")
				? decision.internalStep.actionValue
				: decision.internalStep.valuePreview,
		}));
	}
	if (decision.internalStep && !decision.internalStep.profileProperty) {
		const actionValue = Object.prototype.hasOwnProperty.call(decision.internalStep, "actionValue")
			? decision.internalStep.actionValue
			: true;
		knownFacts.push({
			factId: `fact-browser-action-${decision.internalStep.action || "unknown"}`,
			path: `browserAction.${decision.internalStep.action || "unknown"}`,
			value: actionValue,
			valueType: typeof actionValue,
			provenance: decision.semanticOwner || "deterministic-semantic-rule",
			explicitness: "derived",
			scope: "current-run",
			freshness: "",
			valuePresent: true,
		});
	}
	const sameIdFacts = knownFacts.filter((fact) => fact.factId === decision.selectedProfileFactId);
	return sameIdFacts.find((fact) => factMatches(decision.selectedProfileFact, fact)) || sameIdFacts[0] || null;
}

function factMatches(repeated, referenced) {
	if (!repeated || !referenced) return false;
	return repeated.factId === referenced.factId
		&& repeated.path === referenced.path
		&& repeated.value === referenced.value
		&& repeated.valueType === referenced.valueType
		&& repeated.provenance === referenced.provenance
		&& repeated.scope === referenced.scope;
}

function isAlreadyCompleted(runtimeState, target, fact) {
	return (runtimeState.completedFields || []).some((field) => {
		return (field.fieldId === target.id && labelsMatch(field.label, target.label))
			|| (field.profilePropertyPath === fact.path && field.label && target.label && field.label.text === target.label.text);
	});
}

function labelsMatch(left, right) {
	return normalizeLabel(left) && normalizeLabel(left) === normalizeLabel(right);
}

function normalizeLabel(label) {
	if (!label) return "";
	return String(label.text || label || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function rejected(reason, decision, details = {}) {
	return {
		type: REJECTED_DECISION,
		reason,
		decisionId: decision && decision.decisionId || "",
		decision,
		provenance: {
			semanticOwner: decision && (decision.semanticOwner || decision.provenance && decision.provenance.semanticOwner) || "",
			approvalOwner: reason.startsWith("policy") ? "policy" : "decision-gate",
		},
		...details,
	};
}

function review(reason, decision, details = {}) {
	return {
		type: REVIEW_ITEM,
		reason,
		decisionId: decision && decision.decisionId || "",
		decision,
		provenance: {
			semanticOwner: decision && (decision.semanticOwner || decision.provenance && decision.provenance.semanticOwner) || "",
			approvalOwner: "safety-guard",
		},
		...details,
	};
}

module.exports = {
	APPROVED_ACTION,
	REJECTED_DECISION,
	REVIEW_ITEM,
	gateDecisionV2,
	gateStepForCurrentObservation,
};
