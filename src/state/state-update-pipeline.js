function buildObservationStatePatch(previousState, observation, date = new Date()) {
	const timestamp = date.toISOString();
	const semanticPage = observation.semanticPage;
	const detectedFields = (semanticPage.interactiveElements || []).map(toVerifiedFieldFact);
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
		detectedFields,
		remainingRequiredFields: getRemainingRequiredFields(detectedFields),
		validationErrors,
		updatedAt: timestamp,
	};
}

function buildSuccessfulActionStatePatch(previousState, step, verification, date = new Date()) {
	const timestamp = date.toISOString();
	const recentActions = [
		...(previousState.recentActions || []),
		{
			action: step.action,
			fieldId: step.field.id,
			fieldLabel: toLabelFact(step.field.label),
			profilePropertyPath: step.profileProperty ? step.profileProperty.path : "",
			provenance: step.provenance || {},
			verifiedAt: timestamp,
			verification: {
				expected: verification.expected,
				actual: verification.actual,
			},
		},
	].slice(-10);

	const completedFields = step.profileProperty
		? upsertCompletedField(previousState.completedFields || [], step, verification, timestamp)
		: previousState.completedFields || [];

	return {
		recentActions,
		completedFields,
		remainingRequiredFields: (previousState.remainingRequiredFields || []).filter((field) => field.id !== step.field.id),
		uploadedFiles: updateUploadedFiles(previousState.uploadedFiles || [], step, verification, timestamp),
		currentExecutionStatus: "running",
		status: "running",
		updatedAt: timestamp,
	};
}

function buildReviewAnswerStatePatch(previousState, reviewAnswer, date = new Date()) {
	const timestamp = date.toISOString();
	const reviewAnswers = upsertReviewAnswer(previousState.reviewAnswers || [], reviewAnswer);

	return {
		reviewAnswers,
		currentExecutionStatus: "running",
		status: "running",
		updatedAt: timestamp,
	};
}

function buildReviewPromptStatePatch(previousState, reviewPrompt, date = new Date()) {
	const timestamp = date.toISOString();

	return {
		pendingReviewPrompt: reviewPrompt,
		manualReview: [...(previousState.manualReview || []), reviewPrompt],
		updatedAt: timestamp,
	};
}

function buildStatusStatePatch(status, date = new Date()) {
	return {
		currentExecutionStatus: status,
		status,
		updatedAt: date.toISOString(),
	};
}

function buildDecisionGateStatePatch(previousState, gateResult, date = new Date()) {
	return {
		decisionGateResults: [...(previousState.decisionGateResults || []), summarizeGateResult(gateResult)].slice(-20),
		updatedAt: date.toISOString(),
	};
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

function upsertCompletedField(completedFields, step, verification, timestamp) {
	const completedField = {
		fieldId: step.field.id,
		label: toLabelFact(step.field.label),
		profilePropertyPath: step.profileProperty.path,
		source: step.profileProperty.source || "",
		provenance: step.provenance || {},
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

function summarizeGateResult(gateResult = {}) {
	return {
		type: gateResult.type || "",
		reason: gateResult.reason || "",
		provenance: gateResult.provenance || {},
	};
}

module.exports = {
	buildDecisionGateStatePatch,
	buildObservationStatePatch,
	buildReviewAnswerStatePatch,
	buildReviewPromptStatePatch,
	buildStatusStatePatch,
	buildSuccessfulActionStatePatch,
};
