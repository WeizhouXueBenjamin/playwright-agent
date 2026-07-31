const { buildCapabilityStep } = require("../capabilities/capability-registry");

const DEFAULT_MIN_CONFIDENCE = 70;

function buildExecutionPlan(matches, options = {}) {
	const minConfidence = options.minConfidence || DEFAULT_MIN_CONFIDENCE;
	const steps = [];
	const reviewItems = [];

	for (const match of matches) {
		const reviewItem = getReviewItem(match, minConfidence);
		if (reviewItem) {
			reviewItems.push(reviewItem);
			continue;
		}

		steps.push(...createActionSteps(match, steps.length + 1));
	}

	return {
		schemaVersion: 1,
		status: reviewItems.length ? "needs-review" : "ready",
		summary: {
			stepCount: steps.length,
			reviewItemCount: reviewItems.length,
			minConfidence,
		},
		steps,
		reviewItems,
	};
}

function getReviewItem(match, minConfidence) {
	if (match.safetyDecision && !match.safetyDecision.allowed) {
		return {
			field: match.field,
			matchedProfileProperty: match.matchedProfileProperty ? withoutRawValue(match.matchedProfileProperty, { includePreview: true }) : null,
			reason: match.safetyDecision.reason,
			message: "Sensitive field requires user review before the agent can answer it.",
			confidenceScore: match.confidenceScore,
			safetyDecision: match.safetyDecision,
		};
	}

	if (!match.matchedProfileProperty) {
		return {
			field: match.field,
			reason: "unmatched-field",
			message: "No profile property was confidently matched to this field.",
			confidenceScore: match.confidenceScore,
			safetyDecision: match.safetyDecision || (match.field.choiceGroup ? match.fieldAnswerSafety : undefined),
		};
	}

	if (match.confidenceScore < minConfidence) {
		return {
			field: match.field,
			matchedProfileProperty: withoutRawValue(match.matchedProfileProperty),
			reason: "low-confidence",
			message: `Match confidence ${match.confidenceScore} is below the required ${minConfidence}.`,
			confidenceScore: match.confidenceScore,
			safetyDecision: match.safetyDecision,
		};
	}

	if (!match.matchedProfileProperty.valuePresent) {
		return {
			field: match.field,
			matchedProfileProperty: withoutRawValue(match.matchedProfileProperty),
			reason: "missing-profile-value",
			message: "The matched profile property has no usable value.",
			confidenceScore: match.confidenceScore,
			safetyDecision: match.safetyDecision,
		};
	}

	return null;
}

function createActionStep(match, order) {
	const actionValue = getActionValue(match);
	const step = buildCapabilityStep({
		id: `step-${order}`,
		order,
		field: match.field,
		profileProperty: withoutRawValue(match.matchedProfileProperty),
		actionValue,
		valuePreview: previewValue(actionValue),
		confidenceScore: match.confidenceScore,
		reasoning: match.reasoning,
	});
	if (match.safetyDecision) step.safetyDecision = match.safetyDecision;
	return step;
}

function createActionSteps(match, startOrder) {
	if (!match.field.choiceGroup) return [createActionStep(match, startOrder)];
	const values = Array.isArray(match.matchedProfileProperty.value)
		? match.matchedProfileProperty.value
		: [match.matchedProfileProperty.value];
	const selectedOptions = values.map((value) => {
		return (match.field.options || []).find((option) => option.label === value);
	}).filter(Boolean);
	const expectation = {
		id: match.field.choiceGroup.id,
		mode: match.field.choiceGroup.mode,
		selectedMemberIds: selectedOptions.map((option) => option.fieldId),
		currentSelectedMemberIds: (match.field.options || []).filter((option) => option.checked).map((option) => option.fieldId),
		members: (match.field.options || []).map((option) => ({
			fieldId: option.fieldId,
			domId: option.domId || "",
			name: option.name || "",
			value: option.value || "",
			role: option.role || "",
			kind: option.kind,
			label: option.label,
		})),
	};

	return selectedOptions.map((option, index) => {
		const actionValue = match.field.choiceGroup.mode === "single" ? option.label : true;
		const step = buildCapabilityStep({
			id: `step-${startOrder + index}`,
			order: startOrder + index,
			field: {
				id: option.fieldId,
				kind: option.kind,
				role: option.role,
				domId: option.domId,
				name: option.name,
				value: option.value,
				label: { text: option.label, source: "choice-group-option", confidence: 1 },
				state: { checked: Boolean(option.checked) },
			},
			profileProperty: withoutRawValue(match.matchedProfileProperty),
			actionValue,
			valuePreview: previewValue(actionValue),
			confidenceScore: match.confidenceScore,
			reasoning: match.reasoning,
		});
		step.choiceGroupField = match.field;
		step.choiceGroupSelectedValues = values;
		step.choiceGroupExpectation = expectation;
		step.verifyChoiceGroup = index === selectedOptions.length - 1;
		if (match.safetyDecision) step.safetyDecision = match.safetyDecision;
		return step;
	});
}

function withoutRawValue(profileProperty, options = {}) {
	const result = {
		path: profileProperty.path,
		valueType: profileProperty.valueType,
		valuePresent: profileProperty.valuePresent,
	};
	if (profileProperty.source) result.source = profileProperty.source;
	if (profileProperty.selectionContext) result.selectionContext = profileProperty.selectionContext;
	if (profileProperty.requiresSponsorship !== undefined) result.requiresSponsorship = profileProperty.requiresSponsorship;
	if (profileProperty.scope) result.scope = profileProperty.scope;
	if (profileProperty.reviewAnswer) result.reviewAnswer = profileProperty.reviewAnswer;
	if (options.includePreview) result.valuePreview = previewValue(profileProperty.value);
	return result;
}

function getActionValue(match) {
	const value = match.matchedProfileProperty.value;
	if (match.field.choiceGroup) return value;
	if (!match.matchedProfileProperty.reviewAnswer) return value;
	if (match.field.kind !== "checkbox") return value;
	const normalized = String(value || "").trim().toLowerCase();
	if (["yes", "true", "y", "agree", "i agree"].includes(normalized)) return true;
	if (["no", "false", "n"].includes(normalized)) return false;
	return value;
}

function previewValue(value) {
	if (typeof value === "boolean") return value;
	const stringValue = String(value);
	if (stringValue.length <= 32) return stringValue;
	return `${stringValue.slice(0, 29)}...`;
}

module.exports = {
	buildExecutionPlan,
};
