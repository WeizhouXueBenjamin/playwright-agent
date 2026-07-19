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
	if (match.safetyDecision && !match.safetyDecision.allowed) {
		return {
			field: match.field,
			matchedProfileProperty: match.matchedProfileProperty ? withoutRawValue(match.matchedProfileProperty) : null,
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
			safetyDecision: match.safetyDecision,
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
	const step = buildCapabilityStep({
		id: `step-${order}`,
		order,
		field: match.field,
		profileProperty: withoutRawValue(match.matchedProfileProperty),
		actionValue: match.matchedProfileProperty.value,
		valuePreview: previewValue(match.matchedProfileProperty.value),
		confidenceScore: match.confidenceScore,
		reasoning: match.reasoning,
	});
	if (match.safetyDecision) step.safetyDecision = match.safetyDecision;
	return step;
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
