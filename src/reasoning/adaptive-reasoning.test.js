const assert = require("node:assert/strict");

const { reasonAboutPage } = require("./adaptive-reasoning");
const { PAGE_INTENTS, detectPageIntent } = require("./page-intent");

assert.equal(detectPageIntent(createPage({
	text: "We use cookies to improve privacy",
	buttons: ["Accept cookies"],
})).intent, PAGE_INTENTS.COOKIE_BANNER);

assert.equal(detectPageIntent(createPage({
	fields: [
		{ label: "Email", inputType: "email" },
		{ label: "Password", inputType: "password" },
	],
	buttons: ["Sign in"],
})).intent, PAGE_INTENTS.LOGIN_PAGE);

assert.equal(detectPageIntent(createPage({
	text: "Welcome to setup",
	buttons: ["Get started"],
})).intent, PAGE_INTENTS.ONBOARDING_FLOW);

assert.equal(detectPageIntent(createPage({
	fields: [
		{ label: "First name", validation: { valid: false, message: "Please fill out this field." } },
	],
})).intent, PAGE_INTENTS.DYNAMIC_VALIDATION);

const loginReasoning = reasonAboutPage(createPage({
	fields: [{ label: "Password", inputType: "password" }],
	buttons: ["Log in"],
}));

assert.equal(loginReasoning.nextObjective.type, "needs-user");
assert.equal(loginReasoning.nextObjective.reason, "login-required");

function createPage(config) {
	const fields = (config.fields || []).map((field, index) => ({
		id: `field-${index + 1}`,
		kind: "text-input",
		role: "textbox",
		inputType: field.inputType || "",
		label: { text: field.label, source: "label", confidence: 0.98 },
		placeholder: "",
		validation: field.validation || { valid: true, message: "" },
		evidence: { visibleText: "" },
	}));
	const buttons = (config.buttons || []).map((label, index) => ({
		id: `button-${index + 1}`,
		kind: "button",
		role: "button",
		inputType: "button",
		label: { text: label, source: "visible-text", confidence: 0.9 },
		labelCandidates: [{ text: label, source: "visible-text", confidence: 0.9 }],
		evidence: { visibleText: label },
	}));

	return {
		title: config.text || "",
		interactiveElements: [...fields, ...buttons],
	};
}
