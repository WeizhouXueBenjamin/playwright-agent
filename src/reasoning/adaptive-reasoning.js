const { detectPageIntent, PAGE_INTENTS } = require("./page-intent");

function reasonAboutPage(semanticPage, runtimeState = {}) {
	const pageIntent = detectPageIntent(semanticPage);

	return {
		schemaVersion: 1,
		pageIntent,
		nextObjective: determineNextObjective(pageIntent, runtimeState),
	};
}

function determineNextObjective(pageIntent, runtimeState) {
	if (pageIntent.intent === PAGE_INTENTS.LOGIN_PAGE) {
		return {
			type: "needs-user",
			reason: "login-required",
			description: "Login page detected; credentials or user assistance are required.",
		};
	}

	if (pageIntent.intent === PAGE_INTENTS.APPLICATION_UNAVAILABLE) {
		return {
			type: "needs-user",
			reason: "application-unavailable",
			description: "The job or application form appears unavailable.",
		};
	}

	if (pageIntent.intent === PAGE_INTENTS.CONFIRMATION_DIALOG) {
		return {
			type: "needs-user",
			reason: "confirmation-required",
			description: "Confirmation dialog detected; irreversible action requires user confirmation.",
		};
	}

	if (pageIntent.intent === PAGE_INTENTS.DYNAMIC_VALIDATION) {
		return {
			type: "continue",
			reason: "resolve-validation-with-visible-fields",
			description: "Browser validation is visible; continue normal field matching before asking for help.",
		};
	}

	if (pageIntent.target && shouldClickIntentTarget(pageIntent.intent)) {
		return {
			type: "action",
			reason: pageIntent.recommendedObjective,
			description: `Handle ${pageIntent.intent}.`,
			target: pageIntent.target,
		};
	}

	return {
		type: "continue",
		reason: pageIntent.recommendedObjective,
		description: "Continue normal field matching and planning.",
	};
}

function shouldClickIntentTarget(intent) {
	return [
		PAGE_INTENTS.COOKIE_BANNER,
		PAGE_INTENTS.MODAL_DIALOG,
		PAGE_INTENTS.ONBOARDING_FLOW,
		PAGE_INTENTS.UNEXPECTED_INTERMEDIATE_PAGE,
	].includes(intent);
}

module.exports = {
	reasonAboutPage,
};
