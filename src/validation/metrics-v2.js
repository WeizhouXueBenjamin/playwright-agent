const METRICS_V2_SCHEMA_VERSION = 1;

function buildMetricsV2(context = {}) {
	const observation = context.observationReport || {};
	const validation = context.validationReport || {};
	const execution = context.executionReport || {};
	const componentValidation = validation.componentValidation || {};
	const coverage = componentValidation.coverage || {};
	const pageProfile = componentValidation.pageProfile || null;
	const applicableComponents = componentValidation.applicableComponents || null;
	const decision = buildDecisionMetrics(execution);
	const observationLayer = buildObservationLayer(observation, validation);
	const page = buildPageLayer(componentValidation);
	const task = buildTaskLayer(execution, context.failureReport);
	const benchmark = buildBenchmarkLayer({
		observation: observationLayer,
		decision,
		page,
		task,
		context,
	});

	return {
		schemaVersion: METRICS_V2_SCHEMA_VERSION,
		mode: "benchmark-metrics-v2",
		layers: {
			observation: observationLayer,
			decision,
			page,
			task,
			benchmark,
		},
		observation: observationLayer,
		decision,
		page,
		task,
		benchmark,
		pageProfile,
		applicableComponents,
		coverage: {
			legacyCoverageRatio: Number(coverage.legacyCoverageRatio || coverage.coverageRatio || 0),
			applicableCoverageRatio: Number(coverage.applicableCoverageRatio || 0),
		},
	};
}

function buildObservationLayer(observation, validation) {
	const summary = observation.summary || {};
	const validationSummary = validation.summary || {};

	return {
		detectedFieldCount: Number(summary.detectedFieldCount || 0),
		consoleErrorCount: Number(summary.consoleErrorCount || 0),
		networkErrorCount: Number(summary.networkErrorCount || 0),
		totalDetectedComponents: Number(validationSummary.totalDetectedComponents || 0),
		unsupportedComponentCount: Number(validationSummary.unsupportedComponentCount || 0),
		potentialRiskCount: Number(validationSummary.potentialRiskCount || 0),
	};
}

function buildDecisionMetrics(execution) {
	const executionTimeline = execution.executionTimeline || [];
	const decisionEntries = executionTimeline.filter((entry) => entry.decision);
	const actionDecisionEntries = decisionEntries.filter((entry) => entry.decision.type === "action");
	const needsReviewEntries = decisionEntries.filter((entry) => entry.decision.type === "needs-review");
	const policyEvaluations = decisionEntries.map((entry) => entry.decision.policyEvaluation || {}).filter((policy) => Object.keys(policy).length);
	const policyViolationCount = policyEvaluations.filter(isPolicyViolation).length;
	const verificationResults = execution.verificationResults || [];
	const verificationConsistentCount = verificationResults.filter((verification) => verification.ok === true).length;
	const verificationInconsistentCount = verificationResults.filter((verification) => verification.ok !== true).length;

	return {
		decisionCount: decisionEntries.length,
		actionDecisionCount: actionDecisionEntries.length,
		needsReviewCount: needsReviewEntries.length,
		policyCompliantCount: Math.max(0, policyEvaluations.length - policyViolationCount),
		policyViolationCount,
		verificationConsistentCount,
		verificationInconsistentCount,
		requiredFieldProgressionScore: calculateRequiredFieldProgressionScore(execution.runtimeTimeline || []),
		strategyConsistencyScore: calculateStrategyConsistencyScore({
			actionDecisionCount: actionDecisionEntries.length,
			verificationInconsistentCount,
			recoveryAttemptCount: execution.summary ? execution.summary.recoveryAttemptCount : 0,
		}),
	};
}

function buildPageLayer(componentValidation) {
	const coverage = componentValidation.coverage || {};
	const pageProfile = componentValidation.pageProfile || {};
	const applicableComponents = componentValidation.applicableComponents || {};

	return {
		pageProfileType: pageProfile.type || "unknown",
		pageProfileConfidence: Number(pageProfile.confidence || 0),
		legacyCoverageRatio: Number(coverage.legacyCoverageRatio || coverage.coverageRatio || 0),
		applicableCoverageRatio: Number(coverage.applicableCoverageRatio || 0),
		requiredApplicableCount: Number(coverage.requiredApplicableCount || 0),
		presentRequiredApplicableCount: Number(coverage.presentRequiredApplicableCount || 0),
		missingRequiredApplicableCount: (coverage.missingRequiredApplicableComponents || []).length,
		applicableComponentCount: (applicableComponents.components || []).length,
	};
}

function buildTaskLayer(execution, failureReport) {
	const summary = execution.summary || {};
	const efficiency = buildTaskEfficiencyMetrics(execution);
	const outcome = buildTaskOutcome(execution, failureReport);

	return {
		status: execution.status || "not-run",
		executedActionCount: Number(summary.executedActionCount || 0),
		recoveryAttemptCount: Number(summary.recoveryAttemptCount || 0),
		retryCount: Number(summary.retryCount || 0),
		verificationFailureCount: Number(summary.verificationFailureCount || 0),
		completedFieldCount: Number(summary.completedFieldCount || 0),
		uploadedFileCount: Number(summary.uploadedFileCount || 0),
		humanConfirmationRequired: Boolean(execution.humanConfirmationRequired),
		stoppedBeforeIrreversibleAction: Boolean(execution.stoppedBeforeIrreversibleAction),
		efficiency,
		outcome,
	};
}

function buildTaskOutcome(execution, failureReport = {}) {
	const status = execution.status || "aborted";
	const terminalState = getTerminalState(execution);
	const policyEvaluation = getBlockingPolicyEvaluation(execution, terminalState);
	const verificationResults = execution.verificationResults || [];
	const failures = failureReport.failures || [];
	const reason = execution.reason || terminalState.reason || inferFailureReason(failures) || status;

	if (isPolicyStopped(execution, terminalState, policyEvaluation)) {
		return outcome("policy-stopped", reason, "Decision", "Safety / Policy", "safe-stop");
	}

	if (status === "completed") {
		return outcome("completed", reason || "completed", null, null, "completed");
	}

	if (status === "max-cycles-reached") {
		return outcome("max-cycles", reason, "Task", "Runtime State Planning", "bounded-stop");
	}

	if (status === "needs-review") {
		const blocker = inferBlockerFromFailures(failures, verificationResults, reason);
		return outcome("needs-review", reason, blocker.layer, blocker.capability, "safe-stop");
	}

	if (status === "recovery-failed" || status === "verification-failed" || status === "needs-user-confirmation") {
		const blocker = inferBlockerFromFailures(failures, verificationResults, reason);
		return outcome("blocked", reason, blocker.layer, blocker.capability, "safe-stop");
	}

	if (status === "not-run" || !execution.status) {
		return outcome("aborted", reason, "Benchmark", "Recovery", "not-started");
	}

	return outcome("aborted", reason, "Task", "Recovery", "aborted");
}

function outcome(status, reason, blockerLayer, blockerCapability, safetyOutcome) {
	return {
		status,
		reason: reason || "",
		blockerLayer,
		blockerCapability,
		safetyOutcome,
	};
}

function getTerminalState(execution) {
	return (execution.executionTimeline || [])
		.map((entry) => entry.terminalState)
		.filter((terminal) => terminal && terminal.reached)
		.pop() || {};
}

function getBlockingPolicyEvaluation(execution, terminalState) {
	const terminalPolicy = terminalState.policyEvaluation || {};
	if (Object.keys(terminalPolicy).length) return terminalPolicy;

	return (execution.executionTimeline || [])
		.map((entry) => entry.decision && entry.decision.policyEvaluation || {})
		.filter((policy) => Object.keys(policy).length)
		.find((policy) => policy.allowed === false || policy.status === "blocked-or-terminal" || policy.status === "violation") || {};
}

function isPolicyStopped(execution, terminalState, policyEvaluation) {
	if (execution.stoppedBeforeIrreversibleAction) return true;
	if (terminalState.status === "awaiting-human-confirmation") return true;
	if (execution.status === "awaiting-human-confirmation") return true;
	if (policyEvaluation.allowed === false && policyEvaluation.status === "requires-confirmation") return true;
	return false;
}

function inferFailureReason(failures) {
	const failure = failures[0];
	return failure ? failure.rootCause : "";
}

function inferBlockerFromFailures(failures, verificationResults, reason = "") {
	if ((verificationResults || []).some((verification) => verification.ok !== true)) {
		return { layer: "Decision", capability: "Verification" };
	}

	const reasonText = String(reason || "").toLowerCase();
	if (reasonText.includes("login") || reasonText.includes("auth")) {
		return { layer: "Decision", capability: "Policy Navigation" };
	}

	const labelFailure = failures.find((failure) => {
		const text = `${failure.area || ""} ${failure.rootCause || ""}`.toLowerCase();
		return text.includes("label") || text.includes("required field");
	});
	if (labelFailure) return { layer: "Task", capability: "Field Identification" };

	const policyFailure = failures.find((failure) => {
		const text = `${failure.area || ""} ${failure.rootCause || ""}`.toLowerCase();
		return text.includes("policy") || text.includes("confirmation") || text.includes("submit");
	});
	if (policyFailure) return { layer: "Decision", capability: "Safety / Policy" };

	const observationFailure = failures.find((failure) => failure.area === "Observation");
	if (observationFailure) return { layer: "Observation", capability: "Page Profile" };

	const detectionFailure = failures.find((failure) => failure.area === "Detection");
	if (detectionFailure) return { layer: "Page", capability: "Applicable Components" };

	const recoveryFailure = failures.find((failure) => failure.area === "Recovery");
	if (recoveryFailure) return { layer: "Task", capability: "Recovery" };

	return { layer: "Task", capability: "Runtime State Planning" };
}

function buildTaskEfficiencyMetrics(execution) {
	const executedActions = execution.executedActions || [];
	const completedFields = execution.finalRuntimeState && execution.finalRuntimeState.completedFields || [];
	const fieldAttemptCounts = countFieldAttempts(executedActions);
	const repeatedFieldAttempts = [...fieldAttemptCounts.values()]
		.reduce((total, count) => total + Math.max(0, count - 1), 0);
	const repeatedFieldKeys = new Set([...fieldAttemptCounts.entries()]
		.filter(([, count]) => count > 1)
		.map(([key]) => key));
	const completedFieldKeys = completedFields
		.map(getCompletedFieldKey)
		.filter(Boolean);
	const skippedVerifiedFields = completedFieldKeys
		.filter((key) => !repeatedFieldKeys.has(key))
		.length;

	return {
		totalActions: executedActions.length,
		repeatedFieldAttempts,
		skippedVerifiedFields,
		averageActionsPerCompletedField: completedFieldKeys.length
			? roundRatio(executedActions.length / completedFieldKeys.length)
			: 0,
		redundantActionRatio: executedActions.length
			? roundRatio(repeatedFieldAttempts / executedActions.length)
			: 0,
	};
}

function countFieldAttempts(executedActions) {
	const counts = new Map();

	for (const action of executedActions) {
		const key = getExecutedActionFieldKey(action);
		if (!key) continue;
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	return counts;
}

function getExecutedActionFieldKey(action = {}) {
	const profilePath = action.profileProperty && action.profileProperty.path || "";
	const labelText = normalizeLabel(action.field);

	if (!profilePath || !labelText) return "";
	return `${profilePath}:${labelText}`;
}

function getCompletedFieldKey(field = {}) {
	const profilePath = field.profilePropertyPath || "";
	const labelText = normalizeLabel(field.label);

	if (!profilePath || !labelText) return "";
	return `${profilePath}:${labelText}`;
}

function normalizeLabel(label) {
	if (!label) return "";
	if (typeof label === "string") return label.trim().toLowerCase();
	return String(label.text || "").trim().toLowerCase();
}

function buildBenchmarkLayer(input) {
	return {
		phaseFailure: input.context.phaseFailure ? input.context.phaseFailure.phase : null,
		successRate: input.task.status === "awaiting-human-confirmation" || input.task.status === "completed" ? 1 : 0,
		runtimeErrorCount: input.observation.consoleErrorCount + input.observation.networkErrorCount,
		verificationFailureCount: input.task.verificationFailureCount,
		applicableCoverageRatio: input.page.applicableCoverageRatio,
		legacyCoverageRatio: input.page.legacyCoverageRatio,
	};
}

function isPolicyViolation(policyEvaluation) {
	if (policyEvaluation.allowed === false && policyEvaluation.status === "requires-confirmation") return false;
	if (policyEvaluation.allowed === false) return true;
	if (policyEvaluation.status === "violation") return true;
	return false;
}

function calculateRequiredFieldProgressionScore(runtimeTimeline) {
	const values = runtimeTimeline
		.map((entry) => Number(entry.remainingRequiredFieldCount))
		.filter((value) => Number.isFinite(value));

	if (!values.length) return 1;
	const first = values[0];
	const last = values[values.length - 1];
	if (first <= 0) return last <= 0 ? 1 : 0;
	return clampRatio((first - last) / first);
}

function calculateStrategyConsistencyScore(input) {
	const actionCount = Number(input.actionDecisionCount || 0);
	if (actionCount === 0) return 1;
	const penalties = Number(input.verificationInconsistentCount || 0) + Number(input.recoveryAttemptCount || 0);
	return clampRatio(1 - penalties / actionCount);
}

function clampRatio(value) {
	const number = Number(value || 0);
	if (!Number.isFinite(number)) return 0;
	return Math.max(0, Math.min(1, number));
}

function roundRatio(value) {
	const number = Number(value || 0);
	if (!Number.isFinite(number)) return 0;
	return Math.round(number * 100) / 100;
}

module.exports = {
	buildMetricsV2,
};
