const PAGE_PROFILE_SCHEMA_VERSION = 1;

function buildPageProfile(semanticPage = {}) {
	const elements = semanticPage.interactiveElements || [];
	const counts = countElements(elements);
	const text = normalizeText([
		semanticPage.title || "",
		...elements.map((element) => element.label && element.label.text || ""),
		...elements.map((element) => element.evidence && element.evidence.visibleText || ""),
		...elements.map((element) => element.placeholder || ""),
	].join(" "));
	const signals = buildSignals(elements, counts, text);
	const classification = classify(signals);

	return {
		schemaVersion: PAGE_PROFILE_SCHEMA_VERSION,
		type: classification.type,
		confidence: classification.confidence,
		signals,
		evidence: classification.evidence,
	};
}

function classify(signals) {
	if (signals.passwordFieldCount > 0 || signals.loginLinkCount > 0 && signals.textInputCount > 0) {
		return profile("authentication", 0.86, ["credential or login controls detected"]);
	}

	if (signals.formControlCount >= 2 || signals.uploadCount > 0) {
		return profile("application-form", 0.82, [`${signals.formControlCount} form controls detected`]);
	}

	if (signals.applicationEntryCount > 0) {
		return profile("application-entry", 0.78, ["application entry control detected"]);
	}

	if (signals.navigationButtonCount > 0 && signals.formControlCount === 0) {
		return profile("intermediate-navigation", 0.66, ["navigation control without form controls"]);
	}

	if (signals.linkCount > 0 && signals.formControlCount === 0) {
		return profile("content-page", 0.58, ["links detected without form controls"]);
	}

	return profile("unknown", 0.3, ["insufficient deterministic profile signals"]);
}

function buildSignals(elements, counts, text) {
	return {
		interactiveElementCount: elements.length,
		formControlCount: counts["text-input"] + counts.selection + counts.checkbox + counts.radio + counts["file-upload"] + counts.editable,
		textInputCount: counts["text-input"] + counts.editable,
		selectionCount: counts.selection,
		checkboxCount: counts.checkbox,
		radioCount: counts.radio,
		uploadCount: counts["file-upload"],
		buttonCount: counts.button,
		linkCount: counts.link,
		requiredCount: elements.filter((element) => element.required).length,
		validationMessageCount: elements.filter((element) => element.validation && element.validation.valid === false && element.validation.message).length,
		navigationButtonCount: elements.filter(isNavigationControl).length,
		applicationEntryCount: elements.filter(isApplicationEntryControl).length,
		passwordFieldCount: elements.filter(isPasswordField).length,
		loginLinkCount: elements.filter((element) => /\b(log in|login|sign in)\b/i.test(labelText(element))).length,
		hasAuthenticationText: /\b(log in|login|sign in|password|username)\b/i.test(text),
		hasApplicationText: /\b(apply|application|resume|cv|cover letter)\b/i.test(text),
	};
}

function countElements(elements) {
	const counts = {
		button: 0,
		checkbox: 0,
		editable: 0,
		"file-upload": 0,
		interactive: 0,
		link: 0,
		radio: 0,
		selection: 0,
		"text-input": 0,
	};

	for (const element of elements) {
		counts[element.kind] = (counts[element.kind] || 0) + 1;
	}

	return counts;
}

function isNavigationControl(element) {
	if (!["button", "link"].includes(element.kind)) return false;
	return /\b(next|continue|proceed|save and continue|back|previous)\b/i.test(labelText(element));
}

function isApplicationEntryControl(element) {
	if (!["button", "link"].includes(element.kind)) return false;
	return /^\s*(apply now|start application|begin application)\s*$/i.test(labelText(element));
}

function isPasswordField(element) {
	return element.inputType === "password" || /\bpassword\b/i.test(`${labelText(element)} ${element.placeholder || ""}`);
}

function labelText(element) {
	return element && element.label && element.label.text ? element.label.text : "";
}

function profile(type, confidence, evidence) {
	return {
		type,
		confidence,
		evidence,
	};
}

function normalizeText(text) {
	return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

module.exports = {
	buildPageProfile,
};
