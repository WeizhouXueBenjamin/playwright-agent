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
		humanConfirmationRequired: requiresHumanConfirmation(result),
		stoppedBeforeIrreversibleAction: result.status === "awaiting-human-confirmation",
		summary: {
			executedActionCount: executedActions.length,
			recoveryAttemptCount: recoveryAttempts.length,
			retryCount: recoveryAttempts.filter((attempt) => attempt.strategy === "retry").length,
			verificationFailureCount: verificationResults.filter((verification) => !verification.ok).length,
			runtimeSnapshotCount: runtimeTimeline.length,
			completedFieldCount: result.runtimeState ? result.runtimeState.completedFields.length : 0,
			uploadedFileCount: result.runtimeState ? result.runtimeState.uploadedFiles.length : 0,
		},
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

module.exports = {
	buildExecutionReport,
};
