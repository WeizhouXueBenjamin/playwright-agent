const { buildExecutionPlan } = require("./planner");
const { buildClickCapabilityStep } = require("../capabilities/capability-registry");
const { evaluateActionTargetPolicy, evaluateNavigationPolicy } = require("../policy/policy-engine");
const { matchFieldsToProfile } = require("../reasoning/field-matching");
const { reasonAboutPage } = require("../reasoning/adaptive-reasoning");

function determineNextAction(semanticPage, profile, options = {}) {
	const adaptiveReasoning = reasonAboutPage(semanticPage, options.runtimeState || {});
	const adaptiveDecision = buildAdaptiveDecision(adaptiveReasoning);
	if (adaptiveDecision) return adaptiveDecision;

	const matches = matchFieldsToProfile(semanticPage, profile, {
		...(options.matching || {}),
		runtimeState: options.runtimeState || {},
	});
	const plan = buildExecutionPlan(matches, options.planning);
	const pendingStep = plan.steps.find((step) => !isStepAlreadySatisfied(step, options.runtimeState));

	if (pendingStep) {
		return {
			type: "action",
			step: {
				...pendingStep,
				id: `cycle-action`,
				order: 1,
			},
			reasoning: pendingStep.reasoning,
			context: { adaptiveReasoning, matches, plan },
		};
	}

	const blockingReviewItems = findBlockingReviewItems(plan.reviewItems);
	if (blockingReviewItems.length) {
		const primaryReviewItem = blockingReviewItems[0];
		return {
			type: "needs-review",
			reason: "required-review-checkpoint",
			details: {
				...primaryReviewItem,
				reviewItems: blockingReviewItems,
				reason: "required-review-items-block-navigation",
				pageUrl: semanticPage.url,
				pageTitle: semanticPage.title,
			},
			context: { adaptiveReasoning, matches, plan },
		};
	}

	const navigationStep = findSafeNavigationStep(semanticPage);
	if (navigationStep) {
		return {
			type: "action",
			step: navigationStep,
			reasoning: `Navigate using "${navigationStep.field.label.text}" after current fields are satisfied.`,
			context: { adaptiveReasoning, matches, plan },
		};
	}

	return {
		type: "none",
		reason: "No pending safe action found.",
		context: { adaptiveReasoning, matches, plan },
	};
}

function findBlockingReviewItems(reviewItems) {
	return (reviewItems || []).filter((item) => {
		return Boolean(item.field && item.field.required)
			|| Boolean(item.safetyDecision && item.safetyDecision.requiresReview);
	}).sort((left, right) => Number(requiresExplicitReview(right)) - Number(requiresExplicitReview(left)));
}

function requiresExplicitReview(item) {
	return Boolean(item.safetyDecision && item.safetyDecision.requiresReview);
}

function buildAdaptiveDecision(adaptiveReasoning) {
	const objective = adaptiveReasoning.nextObjective;

	if (objective.type === "needs-user" || objective.type === "needs-review") {
		return {
			type: "needs-review",
			reason: objective.reason,
			details: {
				pageIntent: adaptiveReasoning.pageIntent,
				description: objective.description,
			},
			context: { adaptiveReasoning },
		};
	}

	if (objective.type !== "action" || !objective.target) return null;
	const policyEvaluation = evaluateActionTargetPolicy(objective.target);
	if (!policyEvaluation.allowed) {
		return {
			type: "needs-review",
			reason: policyEvaluation.reason,
			details: {
				pageIntent: adaptiveReasoning.pageIntent,
				description: objective.description,
				target: objective.target,
			},
			policyEvaluation,
			context: { adaptiveReasoning },
		};
	}

		return {
			type: "action",
			step: buildClickCapabilityStep({
				id: "adaptive-action",
				order: 1,
				field: objective.target,
				profileProperty: null,
				actionValue: true,
			valuePreview: true,
			confidenceScore: adaptiveReasoning.pageIntent.confidenceScore,
			reasoning: objective.description,
			}),
			reasoning: objective.description,
			context: { adaptiveReasoning },
		};
}

function isStepAlreadySatisfied(step, runtimeState = {}) {
	if (isStepCompletedInRuntimeState(step, runtimeState)) return true;

	const state = step.field.state || {};
	const expected = step.actionValue;

	if (step.action === "set-checkbox") {
		return state.checked === Boolean(expected);
	}

	if (step.action === "select-option") {
		return state.value === String(expected) || state.selectedLabel === String(expected);
	}

	if (step.action === "upload-file") {
		const expectedFileName = String(expected).split(/[\\/]/).pop();
		return Array.isArray(state.files) && state.files.some((file) => file.name === expectedFileName);
	}

	if (step.action === "fill-text") {
		return String(state.value || "") === String(expected);
	}

	return false;
}

function isStepCompletedInRuntimeState(step, runtimeState) {
	if (!step.profileProperty || !step.profileProperty.path) return false;
	const label = step.field && step.field.label && step.field.label.text || "";
	if (!label) return false;

	return (runtimeState.completedFields || []).some((field) => {
		return field.profilePropertyPath === step.profileProperty.path
			&& field.label
			&& field.label.text === label;
	});
}

function findSafeNavigationStep(semanticPage) {
	const button = (semanticPage.interactiveElements || []).find((element) => {
		return evaluateNavigationPolicy(element).allowed;
	});

	if (!button) return null;

	return buildClickCapabilityStep({
		id: "cycle-navigation",
		order: 1,
		field: {
			id: button.id,
			kind: button.kind,
			role: button.role,
			label: button.label,
			labelCandidates: button.labelCandidates || [],
			required: false,
			inputType: button.inputType,
			options: [],
		},
		profileProperty: null,
		actionValue: true,
		valuePreview: true,
		confidenceScore: button.label.confidence,
		reasoning: `Generic safe navigation control detected: "${button.label.text}".`,
	});
}

module.exports = {
	determineNextAction,
};
