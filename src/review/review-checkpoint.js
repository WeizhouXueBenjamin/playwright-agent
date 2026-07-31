const crypto = require("node:crypto");

const { FIELD_INTENTS } = require("../reasoning/field-answer-safety");
const { buildFieldFingerprint, normalizeReviewPrompt } = require("./review-resolution");
const { REVIEW_ALLOWED_ACTIONS, REVIEW_TYPES } = require("./review-types");

function buildReviewCheckpoint(input = {}, date = new Date()) {
	const reviewItems = input.reviewItems || [];
	const items = dedupeReviewItems(reviewItems)
		.map((reviewItem, index) => buildReviewRequest({
			reviewItem,
			checkpointId: "",
			index,
		}));
	const checkpointId = `checkpoint-${fingerprint([
		input.pageUrl || "",
		input.pageTitle || "",
		...items.map((item) => item.fieldFingerprint),
	]).slice(0, 16)}`;

	return {
		id: checkpointId,
		pageUrl: input.pageUrl || "",
		pageTitle: input.pageTitle || "",
		createdAt: date.toISOString(),
		reason: input.reason || "required-review-items-block-navigation",
		items: items.map((item) => ({ ...item, checkpointId })),
		decisions: [],
		status: "waiting-for-user",
	};
}

function buildReviewRequest({ reviewItem, checkpointId, index }) {
	const prompt = normalizeReviewPrompt(reviewItem);
	const field = reviewItem.field || {};
	const safetyDecision = reviewItem.safetyDecision || {};
	const type = classifyReviewType({ reviewItem, prompt });

	return {
		id: `review-${index + 1}`,
		checkpointId,
		type,
		fieldId: prompt.fieldId,
		fieldFingerprint: prompt.fieldFingerprint,
		statementFingerprint: field.statementFingerprint
			|| field.consentStatementFingerprint
			|| field.constraints && field.constraints.statementFingerprint
			|| field.evidence && field.evidence.statementFingerprint
			|| prompt.fieldFingerprint,
		fieldIntent: prompt.fieldIntent,
		fieldLabel: prompt.fieldLabel,
		controlType: prompt.controlType,
		fieldState: {
			currentValue: summarizeCurrentValue(field),
			required: Boolean(field.required),
			visible: true,
		},
		options: prompt.options,
		proposedValue: prompt.currentProfileValue,
		proposedAction: getProposedAction({ type, prompt, field }),
		riskLevel: safetyDecision.riskLevel || "low",
		reasonCode: toReasonCode(prompt.safetyReason),
		reason: prompt.message,
		assessment: getAssessment({ type, prompt, field }),
		evidence: (safetyDecision.evidence || []).map((item) => item.value || item).filter(Boolean).slice(0, 5),
		optionMatch: sanitizeOptionMatch(safetyDecision.optionMatch),
		metadata: getMetadata({ type, prompt, field }),
		optionSnapshotId: reviewItem.optionSnapshot && reviewItem.optionSnapshot.snapshotId || "",
		optionsComplete: reviewItem.optionSnapshot ? reviewItem.optionSnapshot.complete === true : field.kind === "selection" ? false : true,
		allowedActions: getAllowedActions({ type, field, prompt }),
		status: "pending",
		legacyPrompt: prompt,
	};
}

function classifyReviewType({ reviewItem, prompt }) {
	const field = reviewItem.field || {};
	if (prompt.fieldIntent === FIELD_INTENTS.PRIVACY_CONSENT || prompt.fieldIntent === FIELD_INTENTS.LEGAL_DECLARATION) {
		return REVIEW_TYPES.CONSENT_AUTHORIZATION;
	}
	if (field.kind === "file-upload") return REVIEW_TYPES.FILE_REQUIRED;
	if ((prompt.options || []).length) return REVIEW_TYPES.OPTION_SELECTION;
	if (prompt.currentProfileValue) return REVIEW_TYPES.CONFIRM_PROPOSED_VALUE;
	return REVIEW_TYPES.MANUAL_VALUE_REQUIRED;
}

function getProposedAction({ type, prompt, field }) {
	if (type === REVIEW_TYPES.CONSENT_AUTHORIZATION) {
		return { type: actionForField(field), value: field.kind === "checkbox" ? true : null };
	}
	if (type === REVIEW_TYPES.CONFIRM_PROPOSED_VALUE) {
		return { type: actionForField(field), value: prompt.currentProfileValue };
	}
	return null;
}

function getAllowedActions({ type, field, prompt }) {
	if (type === REVIEW_TYPES.CONSENT_AUTHORIZATION && field.kind === "selection" && !(prompt.options || []).length) {
		return ["manual", "decline", "stop"];
	}
	return REVIEW_ALLOWED_ACTIONS[type];
}

function actionForField(field) {
	if (field.kind === "checkbox") return "check";
	if (field.kind === "selection" || field.kind === "radio") return "select";
	if (field.kind === "file-upload") return "upload";
	return "fill";
}

function getAssessment({ type, prompt, field }) {
	if (type === REVIEW_TYPES.CONSENT_AUTHORIZATION) {
		return field.required
			? "This required field represents legal or privacy authorization for the current statement."
			: "This field represents legal or privacy authorization.";
	}
	if (type === REVIEW_TYPES.MANUAL_VALUE_REQUIRED) return prompt.message;
	if (type === REVIEW_TYPES.OPTION_SELECTION && prompt.safetyReason && prompt.safetyReason !== "review-required") {
		return `Choose one of the observed options. Automatic matching was refused: ${prompt.safetyReason}.`;
	}
	if (type === REVIEW_TYPES.OPTION_SELECTION) return "Choose one of the observed options or skip when safe.";
	if (type === REVIEW_TYPES.FILE_REQUIRED) return "A file is requested and must be explicitly configured or supplied by the user.";
	return "Confirm or replace the proposed value before the agent uses it.";
}

function sanitizeOptionMatch(optionMatch) {
	if (!optionMatch || typeof optionMatch !== "object") return null;
	return {
		status: optionMatch.status || "",
		tier: optionMatch.tier || "",
		reason: optionMatch.reason || "",
		candidateCount: optionMatch.candidateCount || 0,
		candidates: (optionMatch.candidates || []).slice(0, 3).map((candidate) => ({
			label: candidate.label || "",
			score: candidate.score,
		})),
	};
}

function getMetadata({ type, prompt, field }) {
	return {
		sensitive: prompt.fieldIntent !== "low-risk" && prompt.fieldIntent !== "unknown",
		voluntary: false,
		allowPreferNotToAnswer: type === REVIEW_TYPES.OPTION_SELECTION && prompt.fieldIntent !== "privacy-consent",
		multiple: Boolean(field.choiceGroup && field.choiceGroup.mode === "multiple"),
		choiceGroupRule: field.choiceGroup && field.choiceGroup.rule || "",
	};
}

function summarizeCurrentValue(field) {
	const state = field.state || {};
	if (Array.isArray(state.selectedLabels)) return state.selectedLabels;
	if (Object.prototype.hasOwnProperty.call(state, "checked")) return state.checked;
	if (Object.prototype.hasOwnProperty.call(state, "selectedLabel")) return state.selectedLabel || state.value || "";
	if (Array.isArray(state.files)) return state.files.map((file) => file.name);
	return state.value || "";
}

function dedupeReviewItems(reviewItems) {
	const seen = new Set();
	const result = [];
	for (const item of reviewItems) {
		const field = item.field || {};
		const key = [
			buildFieldFingerprint(field),
			field.statementFingerprint || field.consentStatementFingerprint || "",
		].join(":");
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(item);
	}
	return result;
}

function toReasonCode(reason) {
	return String(reason || "review-required").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toUpperCase();
}

function fingerprint(parts) {
	return crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

module.exports = {
	buildReviewCheckpoint,
	buildReviewRequest,
};
