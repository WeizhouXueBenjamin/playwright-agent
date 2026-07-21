function buildExecutionReport(result) {
	const lifecycle = result.lifecycle || [];
	const executedActions = lifecycle
		.filter((entry) => entry.actionResult)
		.map((entry) => buildExecutedAction(entry));
	const recoveryAttempts = lifecycle
		.filter((entry) => entry.recovery)
		.map((entry) => ({
			cycle: entry.cycle,
			timestamp: entry.timestamp,
			status: entry.recovery.status,
			strategy: entry.recovery.strategy,
			failureType: entry.recovery.failureType,
			message: entry.recovery.message,
			retryAttempt: entry.recovery.retryAttempt,
		}));
	const verificationResults = executedActions.map((action) => ({
		cycle: action.cycle,
		timestamp: action.timestamp,
		action: action.action,
		field: action.field,
		ok: action.verification && action.verification.ok === true,
		verification: action.verification,
	}));
	const runtimeTimeline = lifecycle
		.filter((entry) => entry.runtimeStateSnapshot)
		.map((entry) => ({
			cycle: entry.cycle,
			timestamp: entry.timestamp,
			phase: entry.phase,
			status: entry.runtimeStateSnapshot.currentExecutionStatus,
			url: entry.runtimeStateSnapshot.currentUrl,
			completedFieldCount: entry.runtimeStateSnapshot.completedFields.length,
			completedActionCount: entry.runtimeStateSnapshot.completedActions.length,
			remainingRequiredFieldCount: entry.runtimeStateSnapshot.remainingRequiredFields.length,
			validationErrorCount: entry.runtimeStateSnapshot.validationErrors.length,
			runtimeState: entry.runtimeStateSnapshot,
		}));

	return {
		schemaVersion: 1,
		mode: "partial-execution",
		objective: "Validate safe browser execution without irreversible actions.",
		status: result.status,
		reason: result.reason,
		productSuccessOutcome: getProductSuccessOutcome(result),
		humanConfirmationRequired: requiresHumanConfirmation(result),
		stoppedBeforeIrreversibleAction: result.status === "awaiting-human-confirmation",
		reviewPrompt: getReviewPrompt(result),
		reviewPromptText: result.reviewPromptText || "",
		summary: {
			executedActionCount: executedActions.length,
			recoveryAttemptCount: recoveryAttempts.length,
			retryCount: recoveryAttempts.filter((attempt) => attempt.strategy === "retry").length,
			verificationFailureCount: verificationResults.filter((verification) => !verification.ok).length,
			runtimeSnapshotCount: runtimeTimeline.length,
			completedFieldCount: result.runtimeState ? result.runtimeState.completedFields.length : 0,
			uploadedFileCount: result.runtimeState ? result.runtimeState.uploadedFiles.length : 0,
			reviewItemsResolved: countResolvedReviewItems(result),
			remainingUnresolvedReviewItems: result.status === "needs-review" ? 1 : 0,
			sensitiveAnswersProtected: getSafetyMetrics(result).unsafeActionsExecuted === 0,
			finalSubmissionOccurred: false,
			nextUserAction: getNextUserAction(result),
		},
		safetyMetrics: getSafetyMetrics(result),
		executedActions,
		recoveryAttempts,
		retries: recoveryAttempts.filter((attempt) => attempt.strategy === "retry"),
		verificationResults,
		runtimeTimeline,
		executionTimeline: lifecycle.map((entry) => buildTimelineEntry(entry)),
		finalRuntimeState: result.runtimeState,
	};
}

function buildExecutedAction(entry) {
	const step = entry.actionResult.step;

	return {
		cycle: entry.cycle,
		timestamp: entry.timestamp,
		action: step.action,
		field: step.field && step.field.label,
		profileProperty: step.profileProperty,
		confidenceScore: step.confidenceScore,
		safetyDecision: step.safetyDecision,
		verification: entry.actionResult.verification,
	};
}

function buildTimelineEntry(entry) {
	const timelineEntry = {
		cycle: entry.cycle,
		timestamp: entry.timestamp,
		phase: entry.phase,
		url: entry.url,
		decision: entry.decision,
		terminalState: entry.terminalState,
	};
	const safetyDecision = extractTimelineSafetyDecision(entry);
	if (safetyDecision) timelineEntry.safetyDecision = safetyDecision;

	if (entry.actionResult) {
		timelineEntry.action = {
			type: entry.actionResult.step.action,
			field: entry.actionResult.step.field && entry.actionResult.step.field.label,
			verificationOk: entry.actionResult.verification.ok === true,
			safetyDecision: entry.actionResult.step.safetyDecision,
		};
	}

	if (entry.recovery) {
		timelineEntry.recovery = entry.recovery;
	}
	if (entry.reviewPrompt) {
		timelineEntry.reviewPrompt = entry.reviewPrompt;
	}
	if (entry.reviewAnswer) {
		timelineEntry.reviewAnswer = entry.reviewAnswer;
	}

	return timelineEntry;
}

function extractTimelineSafetyDecision(entry) {
	if (entry.decision && entry.decision.safetyDecision) return entry.decision.safetyDecision;
	if (entry.decision && entry.decision.details && entry.decision.details.safetyDecision) return entry.decision.details.safetyDecision;
	if (entry.actionResult && entry.actionResult.step && entry.actionResult.step.safetyDecision) return entry.actionResult.step.safetyDecision;
	return null;
}

function requiresHumanConfirmation(result) {
	return result.status === "awaiting-human-confirmation" || result.status === "needs-user-confirmation";
}

function getSafetyMetrics(result = {}) {
	const runtimeMetrics = result.runtimeState && result.runtimeState.safetyMetrics || {};
	const safetyDecisions = collectSafetyDecisions(result.lifecycle || []);
	const executedUnsafeActions = (result.lifecycle || []).filter((entry) => {
		const safetyDecision = entry.actionResult && entry.actionResult.step && entry.actionResult.step.safetyDecision;
		return safetyDecision && safetyDecision.allowed === false;
	}).length;

	return {
		highRiskFieldsDetected: Math.max(Number(runtimeMetrics.highRiskFieldsDetected || 0), safetyDecisions.filter((decision) => decision.riskLevel === "high").length),
		unsafeMatchesRejected: Math.max(Number(runtimeMetrics.unsafeMatchesRejected || 0), safetyDecisions.filter((decision) => decision.allowed === false && decision.reason === "sensitive-field-unsafe-profile-match").length),
		incompatibleValuesRejected: Math.max(Number(runtimeMetrics.incompatibleValuesRejected || 0), safetyDecisions.filter((decision) => decision.allowed === false && decision.valueCompatibility && decision.valueCompatibility.allowed === false).length),
		sensitiveReviewItemsCreated: Number(runtimeMetrics.sensitiveReviewItemsCreated || 0),
		reviewAnswersProvided: Number(runtimeMetrics.reviewAnswersProvided || 0),
		reviewAnswersApplied: Number(runtimeMetrics.reviewAnswersApplied || 0),
		unsafeActionsExecuted: Number(runtimeMetrics.unsafeActionsExecuted || executedUnsafeActions),
	};
}

function collectSafetyDecisions(lifecycle) {
	const decisions = [];
	for (const entry of lifecycle) {
		const safetyDecision = extractTimelineSafetyDecision(entry);
		if (safetyDecision) decisions.push(safetyDecision);
	}
	return decisions;
}

function countResolvedReviewItems(result = {}) {
	return (result.lifecycle || []).filter((entry) => entry.reviewAnswer).length;
}

function getProductSuccessOutcome(result = {}) {
	if (result.status === "needs-review") return "needs-review-resumable";
	if (result.status === "awaiting-human-confirmation") return "ready-for-review";
	if (result.status === "completed") return "partial-success";
	if (result.status === "needs-user-confirmation" || result.status === "recovery-failed") return "protected-stop";
	return "failure";
}

function getNextUserAction(result = {}) {
	const reviewPrompt = getReviewPrompt(result);
	if (result.status === "needs-review" && reviewPrompt) return reviewPrompt.minimumInputRequired;
	if (result.status === "awaiting-human-confirmation") return "Review the completed application and submit manually if appropriate.";
	if (result.status === "needs-user-confirmation") return "Review the page and decide whether to continue manually.";
	return "Review the run result.";
}

function getReviewPrompt(result = {}) {
	return result.reviewPrompt || result.runtimeState && result.runtimeState.pendingReviewPrompt || null;
}

module.exports = {
	buildExecutionReport,
};
