function classifyFailure(context) {
	const {
		step,
		actionResult,
		beforeObservation,
		afterObservation,
		runtimeState,
	} = context;

	const errorText = getErrorText(actionResult);

	if (step.action === "upload-file") {
		return buildFailure("upload-failure", "File upload action failed verification.", context);
	}

	if (isStaleElementError(errorText)) {
		return buildFailure("stale-element", "The target element became unavailable during execution.", context);
	}

	if (hasUnexpectedNavigation(step, beforeObservation, afterObservation)) {
		return buildFailure("unexpected-navigation", "The page URL changed after a non-navigation action.", context);
	}

	if (hasDynamicPageChange(beforeObservation, afterObservation) && !isClickStep(step)) {
		return buildFailure("dynamic-page-change", "The page changed while the action was being verified.", context);
	}

	if (hasValidationErrors(runtimeState)) {
		return buildFailure("validation-error", "The browser reports validation errors.", context);
	}

	if (hasMissingRequiredFields(runtimeState)) {
		return buildFailure("missing-required-field", "The browser reports required fields that are still empty.", context);
	}

	if (isClickStep(step)) {
		return buildFailure("failed-click", "Click did not produce a verified page-state change.", context);
	}

	return buildFailure("action-verification-failed", "Action verification failed.", context);
}

function buildFailure(type, message, context) {
	return {
		type,
		message,
		retryKey: `${type}:${context.step.action}:${context.step.field.id}:${context.step.field.label.text}`,
		step: {
			action: context.step.action,
			fieldId: context.step.field.id,
			fieldLabel: context.step.field.label,
		},
		verification: context.actionResult.verification,
	};
}

function getErrorText(actionResult) {
	return String(actionResult && actionResult.verification && actionResult.verification.error || "");
}

function isStaleElementError(errorText) {
	return /detached|stale|not attached|element is not attached/i.test(errorText);
}

function hasUnexpectedNavigation(step, beforeObservation, afterObservation) {
	if (!afterObservation || isClickStep(step)) return false;
	return beforeObservation.semanticPage.url !== afterObservation.semanticPage.url;
}

function hasDynamicPageChange(beforeObservation, afterObservation) {
	if (!afterObservation) return false;
	return beforeObservation.fingerprint !== afterObservation.fingerprint;
}

function hasValidationErrors(runtimeState) {
	return Boolean(runtimeState && runtimeState.validationErrors && runtimeState.validationErrors.length);
}

function hasMissingRequiredFields(runtimeState) {
	return Boolean(runtimeState && runtimeState.remainingRequiredFields && runtimeState.remainingRequiredFields.length);
}

function isClickStep(step) {
	return step.action === "click";
}

module.exports = {
	classifyFailure,
};
