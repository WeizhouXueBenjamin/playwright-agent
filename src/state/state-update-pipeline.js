function buildObservationStatePatch(previousState, observation, date = new Date()) {
	const timestamp = date.toISOString();
	const semanticPage = observation.semanticPage;
	const detectedFields = (semanticPage.interactiveElements || []).map(toVerifiedFieldFact);
	const detectedForms = (semanticPage.forms || []).map(toVerifiedFormFact);
	const validationErrors = detectedFields
		.filter((field) => field.validation && field.validation.valid === false)
		.map((field) => ({
			fieldId: field.id,
			label: field.label,
			message: field.validation.message,
			observedAt: timestamp,
		}));

	return {
		currentUrl: semanticPage.url,
		currentPageTitle: semanticPage.title,
		currentBrowserState: "observed",
		detectedForms,
		detectedFields,
		remainingRequiredFields: getRemainingRequiredFields(detectedFields),
		validationErrors,
		navigationHistory: appendNavigation(previousState.navigationHistory, semanticPage.url, semanticPage.title, timestamp),
		updatedAt: timestamp,
	};
}

function buildSuccessfulActionStatePatch(previousState, step, verification, date = new Date()) {
	const timestamp = date.toISOString();
	const completedActions = [
		...previousState.completedActions,
		{
			action: step.action,
			fieldId: step.field.id,
			fieldLabel: toLabelFact(step.field.label),
			profilePropertyPath: step.profileProperty ? step.profileProperty.path : "",
			verifiedAt: timestamp,
			verification: {
				expected: verification.expected,
				actual: verification.actual,
			},
		},
	];

	const completedFields = step.profileProperty
		? upsertCompletedField(previousState.completedFields, step, verification, timestamp)
		: previousState.completedFields;

	return {
		completedActions,
		completedFields,
		remainingRequiredFields: previousState.remainingRequiredFields.filter((field) => field.id !== step.field.id),
		uploadedFiles: updateUploadedFiles(previousState.uploadedFiles, step, verification, timestamp),
		safetyMetrics: updateActionSafetyMetrics(previousState.safetyMetrics, step),
		currentExecutionStatus: "running",
		updatedAt: timestamp,
	};
}

function buildReviewAnswerStatePatch(previousState, reviewAnswer, date = new Date()) {
	const timestamp = date.toISOString();
	const reviewAnswers = upsertReviewAnswer(previousState.reviewAnswers || [], reviewAnswer);

	return {
		reviewAnswers,
		safetyMetrics: {
			...getSafetyMetrics(previousState.safetyMetrics),
			reviewAnswersProvided: reviewAnswers.length,
		},
		currentExecutionStatus: "running",
		currentBrowserState: "active",
		updatedAt: timestamp,
	};
}

function buildReviewPromptStatePatch(previousState, reviewPrompt, date = new Date()) {
	const timestamp = date.toISOString();
	const metrics = getSafetyMetrics(previousState.safetyMetrics);

	return {
		pendingReviewPrompt: reviewPrompt,
		safetyMetrics: {
			...metrics,
			sensitiveReviewItemsCreated: metrics.sensitiveReviewItemsCreated + 1,
		},
		updatedAt: timestamp,
	};
}

function buildStatusStatePatch(status, date = new Date()) {
	return {
		currentExecutionStatus: status,
		currentBrowserState: isTerminalStatus(status) ? "terminal" : "active",
		updatedAt: date.toISOString(),
	};
}

function isTerminalStatus(status) {
	return [
		"awaiting-human-confirmation",
		"completed",
		"max-cycles-reached",
		"needs-review",
		"needs-user-confirmation",
		"recovery-failed",
		"verification-failed",
	].includes(status);
}

function toVerifiedFieldFact(field) {
	return {
		id: field.id,
		kind: field.kind,
		role: field.role || "",
		tagName: field.tagName || "",
		inputType: field.inputType || "",
		label: toLabelFact(field.label),
		placeholder: field.placeholder || "",
		required: Boolean(field.required),
		disabled: Boolean(field.disabled),
		readonly: Boolean(field.readonly),
		state: sanitizeState(field.state || {}),
		options: (field.options || []).map((option) => ({
			label: option.label,
			disabled: Boolean(option.disabled),
		})),
		validation: sanitizeValidation(field.validation || {}),
	};
}

function toVerifiedFormFact(form) {
	return {
		id: form.id,
		label: form.label || "",
		method: form.method || "",
		actionPresent: Boolean(form.actionPresent),
		controls: form.controls || [],
	};
}

function toLabelFact(label) {
	return {
		text: label && label.text ? label.text : "",
		source: label && label.source ? label.source : "",
	};
}

function sanitizeState(state) {
	const clean = {};

	if (Object.prototype.hasOwnProperty.call(state, "value")) clean.value = state.value;
	if (Object.prototype.hasOwnProperty.call(state, "checked")) clean.checked = state.checked;
	if (Object.prototype.hasOwnProperty.call(state, "selectedLabel")) clean.selectedLabel = state.selectedLabel;
	if (Array.isArray(state.files)) clean.files = state.files.map((file) => ({ name: file.name, size: file.size }));

	return clean;
}

function sanitizeValidation(validation) {
	return {
		valid: validation.valid !== false,
		message: validation.message || "",
	};
}

function getRemainingRequiredFields(fields) {
	return fields
		.filter((field) => field.required && !isFieldCompletedByObservedState(field))
		.map((field) => ({
			id: field.id,
			label: field.label,
			kind: field.kind,
		}));
}

function isFieldCompletedByObservedState(field) {
	if (field.kind === "checkbox" || field.kind === "radio") return field.state.checked === true;
	if (field.kind === "selection") return Boolean(field.state.value || field.state.selectedLabel);
	if (Array.isArray(field.state.files)) return field.state.files.length > 0;
	return Boolean(field.state.value);
}

function appendNavigation(history, url, title, timestamp) {
	const lastEntry = history[history.length - 1];
	if (lastEntry && lastEntry.url === url && lastEntry.title === title) return history;

	return [
		...history,
		{
			url,
			title,
			observedAt: timestamp,
		},
	];
}

function upsertCompletedField(completedFields, step, verification, timestamp) {
	const completedField = {
		fieldId: step.field.id,
		label: toLabelFact(step.field.label),
		profilePropertyPath: step.profileProperty.path,
		source: step.profileProperty.source || "",
		reviewAnswerFingerprint: step.profileProperty.reviewAnswer ? step.profileProperty.reviewAnswer.fieldFingerprint : "",
		action: step.action,
		verifiedValue: verification.actual,
		verifiedAt: timestamp,
	};

	const existingIndex = completedFields.findIndex((field) => getCompletedFieldKey(field) === getCompletedFieldKey(completedField));
	if (existingIndex === -1) return [...completedFields, completedField];

	return completedFields.map((field, index) => index === existingIndex ? completedField : field);
}

function getCompletedFieldKey(field) {
	return `${field.profilePropertyPath}:${field.label.text}`;
}

function updateUploadedFiles(uploadedFiles, step, verification, timestamp) {
	if (step.action !== "upload-file") return uploadedFiles;

	return [
		...uploadedFiles,
		{
			fieldId: step.field.id,
			files: Array.isArray(verification.actual) ? verification.actual : [],
			verifiedAt: timestamp,
		},
	];
}

function upsertReviewAnswer(reviewAnswers, reviewAnswer) {
	const existingIndex = reviewAnswers.findIndex((answer) => {
		return answer.fieldFingerprint === reviewAnswer.fieldFingerprint
			&& answer.fieldIntent === reviewAnswer.fieldIntent
			&& answer.statementFingerprint === reviewAnswer.statementFingerprint;
	});
	if (existingIndex === -1) return [...reviewAnswers, reviewAnswer];
	return reviewAnswers.map((answer, index) => index === existingIndex ? reviewAnswer : answer);
}

function updateActionSafetyMetrics(metrics, step) {
	const next = getSafetyMetrics(metrics);
	if (step.profileProperty && step.profileProperty.source === "explicit-user-review") {
		next.reviewAnswersApplied += 1;
	}
	if (step.safetyDecision && step.safetyDecision.allowed === false) {
		next.unsafeActionsExecuted += 1;
	}
	return next;
}

function getSafetyMetrics(metrics = {}) {
	return {
		highRiskFieldsDetected: Number(metrics.highRiskFieldsDetected || 0),
		unsafeMatchesRejected: Number(metrics.unsafeMatchesRejected || 0),
		incompatibleValuesRejected: Number(metrics.incompatibleValuesRejected || 0),
		sensitiveReviewItemsCreated: Number(metrics.sensitiveReviewItemsCreated || 0),
		reviewAnswersProvided: Number(metrics.reviewAnswersProvided || 0),
		reviewAnswersApplied: Number(metrics.reviewAnswersApplied || 0),
		unsafeActionsExecuted: Number(metrics.unsafeActionsExecuted || 0),
	};
}

module.exports = {
	buildObservationStatePatch,
	buildReviewAnswerStatePatch,
	buildReviewPromptStatePatch,
	buildStatusStatePatch,
	buildSuccessfulActionStatePatch,
};
