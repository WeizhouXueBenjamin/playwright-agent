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

		steps.push(createActionStep(match, steps.length + 1));
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
	if (!match.matchedProfileProperty) {
		return {
			field: match.field,
			reason: "unmatched-field",
			message: "No profile property was confidently matched to this field.",
			confidenceScore: match.confidenceScore,
		};
	}

	if (match.confidenceScore < minConfidence) {
		return {
			field: match.field,
			matchedProfileProperty: withoutRawValue(match.matchedProfileProperty),
			reason: "low-confidence",
			message: `Match confidence ${match.confidenceScore} is below the required ${minConfidence}.`,
			confidenceScore: match.confidenceScore,
		};
	}

	if (!match.matchedProfileProperty.valuePresent) {
		return {
			field: match.field,
			matchedProfileProperty: withoutRawValue(match.matchedProfileProperty),
			reason: "missing-profile-value",
			message: "The matched profile property has no usable value.",
			confidenceScore: match.confidenceScore,
		};
	}

	return null;
}

function createActionStep(match, order) {
	return {
		id: `step-${order}`,
		order,
		action: inferAction(match.field),
		field: match.field,
		profileProperty: withoutRawValue(match.matchedProfileProperty),
		actionValue: match.matchedProfileProperty.value,
		valuePreview: previewValue(match.matchedProfileProperty.value),
		confidenceScore: match.confidenceScore,
		reasoning: match.reasoning,
		verification: {
			expectedState: inferExpectedState(match.field),
			required: true,
		},
	};
}

function inferAction(field) {
	if (field.kind === "checkbox") return "set-checkbox";
	if (field.kind === "radio") return "select-option";
	if (field.kind === "selection") return "select-option";
	if (field.kind === "editable") return "fill-text";
	return "fill-text";
}

function inferExpectedState(field) {
	if (field.kind === "checkbox") return "checked-state-matches-profile-value";
	if (field.kind === "radio" || field.kind === "selection") return "selected-option-matches-profile-value";
	return "field-value-matches-profile-value";
}

function withoutRawValue(profileProperty) {
	return {
		path: profileProperty.path,
		valueType: profileProperty.valueType,
		valuePresent: profileProperty.valuePresent,
	};
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
