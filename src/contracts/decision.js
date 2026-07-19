const DECISION_SCHEMA_VERSION = 1;

function buildDecisionContract(input) {
	const plannerDecision = input.plannerDecision || {};
	const runtimeState = input.runtimeState || {};
	const semanticPage = input.observation && input.observation.semanticPage ? input.observation.semanticPage : {};
	const terminalState = input.terminalState || {};
	const reasoningSummary = plannerDecision.reasoning || plannerDecision.reason || "";
	const chosenAction = plannerDecision.type === "action" ? summarizeAction(plannerDecision.step) : null;

	const decision = {
		schemaVersion: DECISION_SCHEMA_VERSION,
		type: plannerDecision.type || "unknown",
		goal: input.goal || runtimeState.goal || "",
		supportingEvidence: {
			url: semanticPage.url || runtimeState.currentUrl || "",
			title: semanticPage.title || runtimeState.currentPageTitle || "",
			pageSummary: semanticPage.summary || {},
			runtimeStatus: runtimeState.currentExecutionStatus || "",
			remainingRequiredFieldCount: Array.isArray(runtimeState.remainingRequiredFields)
				? runtimeState.remainingRequiredFields.length
				: 0,
		},
		reasoningSummary,
		chosenAction,
		rejectedAlternatives: [],
		riskAssessment: inferRiskAssessment(plannerDecision, terminalState),
		policyEvaluation: input.policyEvaluation || {
			status: terminalState.reached && terminalState.status !== "running" ? "blocked-or-terminal" : "allowed",
			reason: terminalState.reason || "",
		},
		verificationStrategy: inferVerificationStrategy(plannerDecision, terminalState),
		reasoning: reasoningSummary,
	};

	if (plannerDecision.reason) decision.reason = plannerDecision.reason;
	const safetyDecision = extractSafetyDecision(plannerDecision);
	if (safetyDecision) decision.safetyDecision = safetyDecision;
	if (chosenAction) {
		decision.action = chosenAction.type;
		decision.field = chosenAction.field;
		decision.confidenceScore = chosenAction.confidenceScore;
	}

	assertDecisionContract(decision);
	return decision;
}

function assertDecisionContract(decision) {
	if (!decision || typeof decision !== "object") {
		throw new Error("Decision must be an object.");
	}
	if (decision.schemaVersion !== DECISION_SCHEMA_VERSION) {
		throw new Error(`Unsupported Decision schemaVersion "${decision.schemaVersion}".`);
	}
	if (typeof decision.goal !== "string") {
		throw new Error("Decision goal must be a string.");
	}
	if (!decision.supportingEvidence || typeof decision.supportingEvidence !== "object") {
		throw new Error("Decision requires supportingEvidence.");
	}
	if (typeof decision.reasoningSummary !== "string") {
		throw new Error("Decision reasoningSummary must be a string.");
	}
	if (!Array.isArray(decision.rejectedAlternatives)) {
		throw new Error("Decision rejectedAlternatives must be an array.");
	}
}

function summarizeAction(step) {
	if (!step) return null;

	const action = {
		type: step.action,
		field: step.field && step.field.label,
		profileProperty: step.profileProperty,
		confidenceScore: step.confidenceScore,
		expectedState: step.verification && step.verification.expectedState,
	};
	if (step.safetyDecision) action.safetyDecision = step.safetyDecision;
	return action;
}

function extractSafetyDecision(plannerDecision) {
	if (plannerDecision.safetyDecision) return plannerDecision.safetyDecision;
	if (plannerDecision.step && plannerDecision.step.safetyDecision) return plannerDecision.step.safetyDecision;
	if (plannerDecision.details && plannerDecision.details.safetyDecision) return plannerDecision.details.safetyDecision;
	return null;
}

function inferRiskAssessment(plannerDecision, terminalState) {
	if (terminalState.reached && terminalState.status === "awaiting-human-confirmation") {
		return {
			level: "high",
			reason: terminalState.reason,
		};
	}

	if (plannerDecision.type === "needs-review") {
		return {
			level: "medium",
			reason: plannerDecision.reason || "review-required",
		};
	}

	return {
		level: "low",
		reason: plannerDecision.type === "action" ? "safe-action-selected" : "no-action-selected",
	};
}

function inferVerificationStrategy(plannerDecision, terminalState) {
	if (terminalState.reached) {
		return {
			type: "terminal-state",
			required: false,
			expectedState: terminalState.status,
		};
	}

	const step = plannerDecision.step || {};
	return {
		type: step.action === "click" ? "observe-next-state" : "verify-action-result",
		required: true,
		expectedState: step.verification && step.verification.expectedState,
	};
}

module.exports = {
	DECISION_SCHEMA_VERSION,
	assertDecisionContract,
	buildDecisionContract,
};
