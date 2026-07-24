const crypto = require("node:crypto");

const EXPLICIT_REVIEW_SOURCE = "explicit-user-review";
const CURRENT_RUN_SCOPE = "current-run";

function buildFieldFingerprint(field = {}) {
	const stableDomIdentity = field.domId || field.name || field.ariaLabelledBy || "";
	const input = {
		stableDomIdentity: stableDomIdentity || field.id || "",
		kind: field.kind || "",
		role: field.role || "",
		label: field.label && field.label.text || "",
		placeholder: field.placeholder || "",
		inputType: field.inputType || "",
		statementFingerprint: getStatementFingerprint(field),
	};
	return crypto.createHash("sha1").update(JSON.stringify(input)).digest("hex");
}

function normalizeReviewPrompt(reviewItem = {}) {
	const field = reviewItem.field || {};
	const safetyDecision = reviewItem.safetyDecision || {};
	const label = toLabelFact(field.label);
	const fieldFingerprint = buildFieldFingerprint(field);
	const options = (field.options || [])
		.filter(isAnswerOption)
		.map((option) => ({ label: option.label || option.value || "" }))
		.filter((option) => option.label);
	const currentProfileValue = reviewItem.matchedProfileProperty && reviewItem.matchedProfileProperty.valuePreview
		? reviewItem.matchedProfileProperty.valuePreview
		: "";

	return {
		type: "review-prompt",
		fieldIntent: safetyDecision.fieldIntent || "unknown",
		fieldFingerprint,
		fieldId: field.id || "",
		fieldLabel: label,
		controlType: field.kind || "",
		question: getQuestionText(field, label),
		options,
		currentProfileValue,
		safetyReason: safetyDecision.reason || reviewItem.reason || "review-required",
		message: getSafetyMessage(safetyDecision.reason || reviewItem.reason || "review-required"),
		minimumInputRequired: options.length ? "Choose one of the available answers." : "Provide the exact answer for this field.",
	};
}

function formatReviewPrompt(reviewPrompt) {
	const lines = [
		"Review required:",
		reviewPrompt.question,
		"",
	];

	if (reviewPrompt.options.length) {
		lines.push("Available answers:");
		for (const option of reviewPrompt.options) lines.push(`- ${option.label}`);
		lines.push("");
	}

	if (reviewPrompt.currentProfileValue) {
		lines.push("Profile evidence:");
		lines.push(`"${reviewPrompt.currentProfileValue}"`);
		lines.push("");
	}

	lines.push(reviewPrompt.message);
	lines.push(reviewPrompt.minimumInputRequired);

	return lines.join("\n").trim();
}

function buildReviewAnswer(input = {}, date = new Date()) {
	if (!Object.prototype.hasOwnProperty.call(input, "answer")) {
		throw new Error("Review answer requires answer.");
	}
	const reviewPrompt = input.reviewPrompt || {};
	const reviewItem = input.reviewItem || {};
	const field = input.field || reviewItem.field || {};
	const safetyDecision = input.safetyDecision || reviewItem.safetyDecision || {};
	const fieldIntent = input.fieldIntent || reviewPrompt.fieldIntent || safetyDecision.fieldIntent || "unknown";
	const fieldFingerprint = input.fieldFingerprint || reviewPrompt.fieldFingerprint || buildFieldFingerprint(field);
	const statementFingerprint = input.statementFingerprint
		|| getStatementFingerprint(field)
		|| (requiresStatementScopedAnswer(fieldIntent) ? fieldFingerprint : "");

	return sanitizeReviewAnswer({
		fieldIntent,
		fieldFingerprint,
		fieldId: input.fieldId || reviewPrompt.fieldId || field.id || "",
		fieldLabel: input.fieldLabel || reviewPrompt.fieldLabel || toLabelFact(field.label),
		answer: input.answer,
		answerType: input.answerType || inferAnswerType(input.answer, field),
		source: EXPLICIT_REVIEW_SOURCE,
		scope: CURRENT_RUN_SCOPE,
		resolutionMethod: input.resolutionMethod || "user-confirmed",
		authorizedAt: input.authorizedAt || date.toISOString(),
		safetyReasonResolved: input.safetyReasonResolved || reviewPrompt.safetyReason || safetyDecision.reason || reviewItem.reason || "review-required",
		reusePolicy: input.reusePolicy || "do-not-reuse",
		statementFingerprint,
		authorization: input.authorization || null,
		optionsSnapshot: input.optionsSnapshot || reviewPrompt.options || snapshotOptions(field.options || []),
	});
}

function findReviewAnswerForField(field, fieldIntent, runtimeState = {}) {
	const fingerprint = buildFieldFingerprint(field);
	const statementFingerprint = getStatementFingerprint(field) || fingerprint;

	return (runtimeState.reviewAnswers || []).find((answer) => {
		if (answer.source !== EXPLICIT_REVIEW_SOURCE || answer.scope !== CURRENT_RUN_SCOPE) return false;
		if (answer.fieldFingerprint !== fingerprint) return false;
		if (answer.fieldIntent !== fieldIntent) return false;
		if (requiresStatementScopedAnswer(fieldIntent)) {
			return Boolean(statementFingerprint) && answer.statementFingerprint === statementFingerprint;
		}
		return true;
	}) || null;
}

function createReviewAnswerProfileProperty(reviewAnswer) {
	return {
		path: `reviewAnswers.${reviewAnswer.fieldFingerprint}`,
		value: reviewAnswer.answer,
		valueType: reviewAnswer.answerType || typeof reviewAnswer.answer,
		valuePresent: reviewAnswer.answer !== undefined && reviewAnswer.answer !== null && String(reviewAnswer.answer).trim() !== "",
		source: EXPLICIT_REVIEW_SOURCE,
		scope: CURRENT_RUN_SCOPE,
		reviewAnswer,
	};
}

function sanitizeReviewAnswer(answer) {
	return {
		fieldIntent: answer.fieldIntent,
		fieldFingerprint: answer.fieldFingerprint,
		fieldId: answer.fieldId || "",
		fieldLabel: toLabelFact(answer.fieldLabel),
		answer: answer.answer,
		answerType: answer.answerType || "",
		source: EXPLICIT_REVIEW_SOURCE,
		scope: CURRENT_RUN_SCOPE,
		resolutionMethod: answer.resolutionMethod || "user-confirmed",
		authorizedAt: answer.authorizedAt,
		safetyReasonResolved: answer.safetyReasonResolved,
		reusePolicy: answer.reusePolicy || "do-not-reuse",
		statementFingerprint: answer.statementFingerprint || "",
		authorization: sanitizeAuthorization(answer.authorization),
		optionsSnapshot: snapshotOptions(answer.optionsSnapshot || []),
	};
}

function sanitizeAuthorization(authorization) {
	if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) return null;
	return {
		authorizationType: authorization.authorizationType || "",
		authorized: authorization.authorized === true,
		consentScope: authorization.consentScope || "",
		statementFingerprint: authorization.statementFingerprint || "",
		authorizedAt: authorization.authorizedAt || "",
	};
}

function requiresStatementScopedAnswer(fieldIntent) {
	return fieldIntent === "privacy-consent" || fieldIntent === "legal-declaration";
}

function getQuestionText(field, label) {
	if (label.text) return label.text;
	if (field.placeholder) return field.placeholder;
	return "This required field has no visible label. Please provide the exact answer to continue.";
}

function getSafetyMessage(reason) {
	const messages = {
		"salary-expectation-requires-explicit-answer": "The agent did not infer salary expectations from role title or experience.",
		"sensitive-field-unsafe-profile-match": "The matched profile value is not safe to use for this sensitive field.",
		"sensitive-field-value-format-mismatch": "The profile value does not match the required field format.",
		"sensitive-field-option-not-available": "The profile value does not match any available answer.",
		"sensitive-field-no-explicit-profile-value": "This sensitive field requires an explicit answer.",
		"legal-consent-requires-user-review": "The agent cannot provide legal or privacy consent without your explicit authorization for this statement.",
		"legal-consent-requires-current-statement-authorization": "Consent can only be used for the exact current statement.",
	};
	return messages[reason] || "The agent needs your explicit answer before continuing.";
}

function inferAnswerType(answer, field = {}) {
	if (field.kind === "radio" || field.kind === "selection") return "selection";
	if (field.kind === "checkbox") return "boolean";
	if (typeof answer === "boolean") return "boolean";
	return "text";
}

function toLabelFact(label) {
	return {
		text: label && label.text ? label.text : "",
		source: label && label.source ? label.source : "",
	};
}

function snapshotOptions(options) {
	return (options || [])
		.filter(isAnswerOption)
		.map((option) => ({ label: option.label || option.value || "" }))
		.filter((option) => option.label);
}

function isAnswerOption(option) {
	if (!option || option.disabled) return false;
	const label = String(option.label || option.value || "").trim();
	if (!label) return false;
	if (option.valuePresent === false && /^select(\s|\.|$)/i.test(label)) return false;
	return true;
}

function getStatementFingerprint(field = {}) {
	return field.statementFingerprint
		|| field.consentStatementFingerprint
		|| field.constraints && field.constraints.statementFingerprint
		|| field.evidence && field.evidence.statementFingerprint
		|| "";
}

module.exports = {
	CURRENT_RUN_SCOPE,
	EXPLICIT_REVIEW_SOURCE,
	buildFieldFingerprint,
	buildReviewAnswer,
	createReviewAnswerProfileProperty,
	findReviewAnswerForField,
	formatReviewPrompt,
	normalizeReviewPrompt,
	requiresStatementScopedAnswer,
};
