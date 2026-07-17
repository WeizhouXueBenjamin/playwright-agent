const PAGE_INTENTS = {
	APPLICATION_FORM: "application-form",
	CONFIRMATION_DIALOG: "confirmation-dialog",
	COOKIE_BANNER: "cookie-banner",
	DYNAMIC_VALIDATION: "dynamic-validation",
	LOGIN_PAGE: "login-page",
	MODAL_DIALOG: "modal-dialog",
	ONBOARDING_FLOW: "onboarding-flow",
	RESUME_PARSING_PAGE: "resume-parsing-page",
	UNEXPECTED_INTERMEDIATE_PAGE: "unexpected-intermediate-page",
	UNKNOWN: "unknown",
};

function detectPageIntent(semanticPage) {
	const signals = collectSignals(semanticPage);
	const candidates = [
		detectConfirmationDialog(signals),
		detectCookieBanner(signals),
		detectLoginPage(signals),
		detectResumeParsingPage(signals),
		detectOnboardingFlow(signals),
		detectModalDialog(signals),
		detectDynamicValidation(signals),
		detectApplicationForm(signals),
		detectUnexpectedIntermediatePage(signals),
	].filter(Boolean);

	const best = candidates.sort((left, right) => right.confidenceScore - left.confidenceScore)[0];

	return best || {
		intent: PAGE_INTENTS.UNKNOWN,
		confidenceScore: 0,
		evidence: [],
		recommendedObjective: "observe-page",
	};
}

function collectSignals(semanticPage) {
	const elements = semanticPage.interactiveElements || [];
	const fields = elements.filter((element) => ["text-input", "checkbox", "radio", "selection", "editable"].includes(element.kind));
	const buttons = elements.filter((element) => element.kind === "button");
	const text = [
		semanticPage.title || "",
		...elements.map((element) => element.label && element.label.text || ""),
		...elements.map((element) => element.evidence && element.evidence.visibleText || ""),
		...fields.map((field) => field.placeholder || ""),
		...fields.map((field) => field.validation && field.validation.message || ""),
	].join(" ");

	return {
		semanticPage,
		elements,
		fields,
		buttons,
		text,
		normalizedText: normalizeText(text),
	};
}

function detectCookieBanner(signals) {
	const button = findButton(signals.buttons, [/accept/i, /agree/i, /allow/i, /got it/i, /continue/i]);
	if (!containsAny(signals.normalizedText, ["cookie", "cookies", "privacy"]) || !button) return null;

	return buildIntent(PAGE_INTENTS.COOKIE_BANNER, 86, ["cookie/privacy language", button.label.text], "dismiss-cookie-banner", button);
}

function detectModalDialog(signals) {
	const dialogElement = signals.elements.find((element) => element.role === "dialog" || pathHasRole(element, "dialog"));
	const button = findButton(signals.buttons, [/close/i, /continue/i, /ok/i, /got it/i]);
	if (!dialogElement && !button) return null;
	if (!dialogElement && !containsAny(signals.normalizedText, ["modal", "dialog", "pop up", "popup"])) return null;

	return buildIntent(PAGE_INTENTS.MODAL_DIALOG, dialogElement ? 78 : 58, ["dialog semantics or dialog-like copy"], "handle-modal-dialog", button);
}

function detectLoginPage(signals) {
	const hasPasswordField = signals.fields.some((field) => /password/i.test(`${field.label.text || ""} ${field.placeholder || ""} ${field.inputType || ""}`));
	const hasLoginText = containsAny(signals.normalizedText, ["sign in", "log in", "login"]);
	const hasUsernameField = signals.fields.some((field) => /username/i.test(`${field.label.text || ""} ${field.placeholder || ""}`));
	const button = findButton(signals.buttons, [/sign in/i, /log in/i, /continue/i]);
	if (!hasPasswordField && !(hasLoginText && hasUsernameField)) return null;

	return buildIntent(PAGE_INTENTS.LOGIN_PAGE, 84, ["login credential fields or sign-in language"], "request-login-assistance", button);
}

function detectResumeParsingPage(signals) {
	const hasResumeLanguage = containsAny(signals.normalizedText, ["resume", "cv", "parse", "import profile", "upload"]);
	const button = findButton(signals.buttons, [/continue/i, /next/i, /review/i, /confirm/i]);
	if (!hasResumeLanguage) return null;

	return buildIntent(PAGE_INTENTS.RESUME_PARSING_PAGE, 72, ["resume parsing/import language"], "review-resume-import", button);
}

function detectConfirmationDialog(signals) {
	const hasConfirmationLanguage = containsAny(signals.normalizedText, ["are you sure", "confirm", "confirmation", "please confirm"]);
	const button = findButton(signals.buttons, [/cancel/i, /no/i, /back/i, /close/i]);
	if (!hasConfirmationLanguage) return null;

	return buildIntent(PAGE_INTENTS.CONFIRMATION_DIALOG, 82, ["confirmation language"], "request-confirmation", button);
}

function detectOnboardingFlow(signals) {
	const button = findButton(signals.buttons, [/get started/i, /start/i, /continue/i, /next/i]);
	if (!containsAny(signals.normalizedText, ["welcome", "get started", "onboarding", "setup"]) || !button) return null;

	return buildIntent(PAGE_INTENTS.ONBOARDING_FLOW, 70, ["onboarding/welcome language", button.label.text], "advance-onboarding", button);
}

function detectDynamicValidation(signals) {
	const invalidFields = signals.fields.filter((field) => field.validation && field.validation.valid === false);
	if (!invalidFields.length) return null;

	return {
		intent: PAGE_INTENTS.DYNAMIC_VALIDATION,
		confidenceScore: 94,
		evidence: invalidFields.map((field) => field.validation.message || field.label.text).filter(Boolean),
		recommendedObjective: "resolve-validation-errors",
		target: null,
	};
}

function detectApplicationForm(signals) {
	if (!signals.fields.length) return null;
	return buildIntent(PAGE_INTENTS.APPLICATION_FORM, 68, [`${signals.fields.length} fillable fields observed`], "complete-visible-fields", null);
}

function detectUnexpectedIntermediatePage(signals) {
	const button = findButton(signals.buttons, [/continue/i, /next/i, /proceed/i, /skip/i]);
	if (signals.fields.length || !button) return null;

	return buildIntent(PAGE_INTENTS.UNEXPECTED_INTERMEDIATE_PAGE, 54, ["navigation control without fillable fields"], "advance-intermediate-page", button);
}

function buildIntent(intent, confidenceScore, evidence, recommendedObjective, target) {
	return {
		intent,
		confidenceScore,
		evidence,
		recommendedObjective,
		target: target ? toTarget(target) : null,
	};
}

function toTarget(element) {
	return {
		id: element.id,
		kind: element.kind,
		role: element.role,
		label: element.label,
		labelCandidates: element.labelCandidates || [],
		required: Boolean(element.required),
		inputType: element.inputType,
		options: element.options || [],
	};
}

function findButton(buttons, patterns) {
	return buttons.find((button) => {
		const label = button.label && button.label.text ? button.label.text : "";
		return patterns.some((pattern) => pattern.test(label));
	});
}

function pathHasRole(element, role) {
	return (element.semanticPath || []).some((part) => part.role === role);
}

function containsAny(text, phrases) {
	return phrases.some((phrase) => text.includes(phrase));
}

function normalizeText(text) {
	return String(text).replace(/\s+/g, " ").trim().toLowerCase();
}

module.exports = {
	PAGE_INTENTS,
	detectPageIntent,
};
