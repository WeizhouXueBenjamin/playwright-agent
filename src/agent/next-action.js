const { buildExecutionPlan } = require("./planner");
const { matchFieldsToProfile } = require("../reasoning/field-matching");
const { reasonAboutPage } = require("../reasoning/adaptive-reasoning");

const SAFE_NAVIGATION_PATTERNS = [
	/\bcontinue\b/i,
	/\bnext\b/i,
	/\bsave and continue\b/i,
	/\bproceed\b/i,
];

const FINAL_SUBMIT_PATTERNS = [
	/\bsubmit\b/i,
	/\bapply\b/i,
	/\bsend\b/i,
	/\bfinish\b/i,
	/\bconfirm\b/i,
];

function determineNextAction(semanticPage, profile, options = {}) {
	const adaptiveReasoning = reasonAboutPage(semanticPage, options.runtimeState || {});
	const adaptiveDecision = buildAdaptiveDecision(adaptiveReasoning);
	if (adaptiveDecision) return adaptiveDecision;

	const matches = matchFieldsToProfile(semanticPage, profile, options.matching);
	const plan = buildExecutionPlan(matches, options.planning);
	const pendingStep = plan.steps.find((step) => !isStepAlreadySatisfied(step));

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

	const blockingReviewItem = plan.reviewItems.find((item) => item.field && item.field.required);
	if (blockingReviewItem) {
		return {
			type: "needs-review",
			reason: "required-field-needs-review",
			details: blockingReviewItem,
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

	return {
		type: "action",
		step: {
			id: "adaptive-action",
			order: 1,
			action: "click",
			field: objective.target,
			profileProperty: null,
			actionValue: true,
			valuePreview: true,
			confidenceScore: adaptiveReasoning.pageIntent.confidenceScore,
			reasoning: objective.description,
			verification: {
				expectedState: "page-state-changes-after-click",
				required: true,
			},
		},
		reasoning: objective.description,
		context: { adaptiveReasoning },
	};
}

function isStepAlreadySatisfied(step) {
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

function findSafeNavigationStep(semanticPage) {
	const button = (semanticPage.interactiveElements || []).find((element) => {
		if (element.kind !== "button" || element.disabled) return false;
		const label = element.label && element.label.text ? element.label.text : "";
		if (FINAL_SUBMIT_PATTERNS.some((pattern) => pattern.test(label))) return false;
		return SAFE_NAVIGATION_PATTERNS.some((pattern) => pattern.test(label));
	});

	if (!button) return null;

	return {
		id: "cycle-navigation",
		order: 1,
		action: "click",
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
		verification: {
			expectedState: "page-state-changes-after-click",
			required: true,
		},
	};
}

module.exports = {
	determineNextAction,
};
