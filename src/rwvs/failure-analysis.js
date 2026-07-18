function buildFailureReport(input) {
	const failures = [
		...classifyObservationFailures(input.observationReport),
		...classifyValidationFailures(input.validationReport),
		...classifyExecutionFailures(input.executionReport),
		...classifyPhaseFailure(input.phaseFailure),
	];

	return {
		schemaVersion: 1,
		mode: "rwvs-failure-analysis",
		website: input.website,
		runId: input.runId,
		status: failures.length ? "failures-detected" : "no-failures-detected",
		failures,
	};
}

function classifyObservationFailures(report) {
	if (!report) return [];
	const failures = [];

	if (report.summary.detectedFieldCount === 0) {
		failures.push(failure("Observation", "No fields were detected during observation.", "The agent may not understand the initial page.", "Improve generic page stabilization, visibility filtering, or semantic element extraction."));
	}

	if (report.summary.consoleErrorCount > 0 || report.summary.networkErrorCount > 0) {
		failures.push(failure("Observation", "Runtime page errors were observed.", "Page behavior may be incomplete or unstable during validation.", "Capture diagnostics and correlate errors with missing components before changing execution logic."));
	}

	return failures;
}

function classifyValidationFailures(report) {
	if (!report) return [];
	const failures = [];

	for (const component of report.componentValidation.missingComponents || []) {
		failures.push(failure("Detection", component.message, "Component coverage is incomplete.", `Improve generic detection for ${component.type} components.`));
	}

	for (const component of report.componentValidation.unsupportedComponents || []) {
		failures.push(failure("Detection", component.message, "Unsupported components may block autonomous execution.", "Add generic component support based on semantic role, accessible name, and DOM behavior."));
	}

	for (const risk of report.componentValidation.potentialRisks || []) {
		if (risk.severity !== "high") continue;
		failures.push(failure("Detection", risk.message, "High-risk component interpretation may cause incorrect planning.", "Improve label association and required-field detection using generic semantic context."));
	}

	return failures;
}

function classifyExecutionFailures(report) {
	if (!report) return [];
	const failures = [];

	for (const verification of report.verificationResults || []) {
		if (verification.ok) continue;
		failures.push(failure("Verification", `Action verification failed for ${verification.action}.`, "The agent could not prove an action succeeded before continuing.", "Improve action-specific verification or re-observation logic."));
	}

	for (const attempt of report.recoveryAttempts || []) {
		failures.push(failure("Recovery", `Recovery strategy ${attempt.strategy} was used for ${attempt.failureType}.`, "The workflow required recovery to make progress.", "Improve planning or execution robustness so fewer recoveries are needed."));
	}

	if (report.status === "recovery-failed") {
		failures.push(failure("Recovery", "Recovery failed.", "The workflow could not continue autonomously.", "Add generic fallback strategies after classifying the blocking failure."));
	}

	if (report.status === "needs-review") {
		failures.push(failure("Reasoning", "The agent required human review.", "The workflow could not be completed within current generic confidence boundaries.", "Improve generic reasoning confidence and unsupported-page classification."));
	}

	return failures;
}

function classifyPhaseFailure(phaseFailure) {
	if (!phaseFailure) return [];
	return [
		failure(
			phaseFailure.phase || "Execution",
			phaseFailure.message,
			"The RWVS pipeline stopped before all phases completed.",
			"Fix the generic failing phase, then rerun the benchmark comparison.",
		),
	];
}

function failure(area, rootCause, impact, suggestedImprovement) {
	return {
		area,
		rootCause,
		impact,
		suggestedImprovement,
	};
}

module.exports = {
	buildFailureReport,
};
