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
	const task = buildTaskLayer(execution);
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

function buildTaskLayer(execution) {
	const summary = execution.summary || {};

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
	};
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

module.exports = {
	buildMetricsV2,
};
