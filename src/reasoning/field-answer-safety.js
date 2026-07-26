const { buildFieldFingerprint } = require("../review/review-resolution");

const FIELD_INTENTS = {
	SALARY_EXPECTATION: "salary-expectation",
	CURRENT_SALARY: "current-salary",
	WORK_AUTHORIZATION: "work-authorization",
	SPONSORSHIP_REQUIRED: "sponsorship-required",
	VISA_TYPE: "visa-type",
	LEGAL_DECLARATION: "legal-declaration",
	PRIVACY_CONSENT: "privacy-consent",
	REFERRAL_SOURCE: "referral-source",
	LOW_RISK: "low-risk",
};

const HIGH_RISK_INTENTS = new Set([
	FIELD_INTENTS.SALARY_EXPECTATION,
	FIELD_INTENTS.CURRENT_SALARY,
	FIELD_INTENTS.WORK_AUTHORIZATION,
	FIELD_INTENTS.SPONSORSHIP_REQUIRED,
	FIELD_INTENTS.VISA_TYPE,
	FIELD_INTENTS.LEGAL_DECLARATION,
	FIELD_INTENTS.PRIVACY_CONSENT,
	FIELD_INTENTS.REFERRAL_SOURCE,
]);

const INTENT_RULES = [
	{
		intent: FIELD_INTENTS.CURRENT_SALARY,
		patterns: [
			/\bcurrent\s+(salary|compensation|pay|remuneration)\b/,
			/\b(previous|present)\s+(salary|compensation|pay)\b/,
		],
	},
	{
		intent: FIELD_INTENTS.SALARY_EXPECTATION,
		patterns: [
			/\bsalary\s+expectation(s)?\b/,
			/\b(expected|desired|target)\s+(salary|compensation|pay|remuneration)\b/,
			/\b(pay|compensation|remuneration)\s+expectation(s)?\b/,
			/\bhourly\s+(rate|pay)\b/,
			/\bdesired\s+rate\b/,
		],
	},
	{
		intent: FIELD_INTENTS.SPONSORSHIP_REQUIRED,
		patterns: [
			/\b(require|need|needs|requiring)\s+(visa\s+)?sponsorship\b/,
			/\bsponsorship\s+(required|needed)\b/,
			/\bvisa\s+sponsorship\b/,
		],
	},
	{
		intent: FIELD_INTENTS.WORK_AUTHORIZATION,
		patterns: [
			/\b(work|employment)\s+(authorization|eligibility)\b/,
			/\bright\s+to\s+work\b/,
			/\blegally\s+authorized\s+to\s+work\b/,
			/\bauthorized\s+to\s+work\b/,
			/\beligible\s+to\s+work\b/,
		],
	},
	{
		intent: FIELD_INTENTS.VISA_TYPE,
		patterns: [
			/\bvisa\s+(type|status|class|category)\b/,
			/\bimmigration\s+status\b/,
			/\bwork\s+permit\s+type\b/,
		],
	},
	{
		intent: FIELD_INTENTS.PRIVACY_CONSENT,
		patterns: [
			/\bprivacy\s+(policy|notice|statement)\b/,
			/\bdata\s+(processing|privacy|retention|collection)\b/,
			/\b(consent|agree|acknowledge).{0,80}\b(privacy|data|terms)\b/,
			/\b(privacy|data|terms).{0,80}\b(consent|agree|acknowledge)\b/,
		],
	},
	{
		intent: FIELD_INTENTS.LEGAL_DECLARATION,
		patterns: [
			/\blegal\s+(declaration|statement|acknowledg(e)?ment)\b/,
			/\b(declare|certify|attest)\b/,
			/\bconfirm.{0,80}\b(true|truthful|accurate|accuracy|complete|correct)\b/,
			/\bterms\s+(and\s+conditions|of\s+use)\b/,
			/\bbackground\s+check\b/,
			/\bcriminal\s+(record|history)\b/,
		],
	},
	{
		intent: FIELD_INTENTS.REFERRAL_SOURCE,
		patterns: [
			/\bhow\s+did\s+you\s+hear\b/,
			/\bwhere\s+did\s+you\s+hear\b/,
			/\bhear\s+about\s+(us|this|the\s+role|the\s+job)\b/,
			/\breferral\s+(source|name)?\b/,
			/\breferred\s+by\b/,
			/\bsource\b/,
			/\bsource\s+of\s+(application|referral)\b/,
		],
	},
];

const ALLOWED_PROFILE_KEYS_BY_INTENT = {
	[FIELD_INTENTS.SALARY_EXPECTATION]: new Set(["salaryExpectation"]),
	[FIELD_INTENTS.CURRENT_SALARY]: new Set(["currentSalary"]),
	[FIELD_INTENTS.WORK_AUTHORIZATION]: new Set(["workAuthorization"]),
	[FIELD_INTENTS.SPONSORSHIP_REQUIRED]: new Set(["requiresSponsorship"]),
	[FIELD_INTENTS.VISA_TYPE]: new Set(["visaType"]),
	[FIELD_INTENTS.LEGAL_DECLARATION]: new Set(["legalDeclarationAuthorization"]),
	[FIELD_INTENTS.PRIVACY_CONSENT]: new Set(["consentAuthorization"]),
	[FIELD_INTENTS.REFERRAL_SOURCE]: new Set(["referralSource"]),
};

function classifyFieldIntent(field) {
	const evidence = collectFieldEvidence(field);
	const primaryEvidence = collectPrimaryIntentEvidence(field, evidence);
	const primaryText = primaryEvidence.map((item) => item.value).join(" ").toLowerCase();
	const primaryMatchedRule = INTENT_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(primaryText)));
	const shouldUsePrimaryOnly = primaryEvidence.length && field.label && field.label.text && Number(field.label.confidence || 0) >= 0.9;
	const searchableText = shouldUsePrimaryOnly ? primaryText : evidence.map((item) => item.value).join(" ").toLowerCase();
	const matchedRule = primaryMatchedRule || INTENT_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(searchableText)));
	const fieldIntent = matchedRule ? matchedRule.intent : FIELD_INTENTS.LOW_RISK;

	return {
		fieldIntent,
		riskLevel: HIGH_RISK_INTENTS.has(fieldIntent) ? "high" : "low",
		reason: matchedRule ? "sensitive-field-intent-detected" : "low-risk-field",
		requiresReview: false,
		evidence: evidence.filter((item) => item.value),
	};
}

function collectPrimaryIntentEvidence(field, evidence) {
	const primarySources = new Set(["label", "aria-label", "aria-labelledby", "placeholder", "visible-text", "option", "fieldset-legend"]);
	return evidence.filter((item) => primarySources.has(item.source));
}

function evaluateFieldAnswerSafety(field, matchedProfileProperty) {
	const classification = classifyFieldIntent(field);
	const matchedProperty = matchedProfileProperty && matchedProfileProperty.path || null;
	const explicitReviewAnswer = matchedProfileProperty && matchedProfileProperty.source === "explicit-user-review"
		? matchedProfileProperty.reviewAnswer || null
		: null;

	if (classification.riskLevel !== "high") {
		return buildDecision({
			...classification,
			allowed: true,
			matchedProperty,
			reason: "low-risk-field-approved",
			requiresReview: false,
		});
	}

	if (!matchedProfileProperty) {
		return buildDecision({
			...classification,
			allowed: false,
			matchedProperty,
			reason: getNoExplicitValueReason(classification.fieldIntent),
			requiresReview: true,
		});
	}

	if (!explicitReviewAnswer && !isProfilePropertyAllowed(classification.fieldIntent, matchedProfileProperty.path)) {
		return buildDecision({
			...classification,
			allowed: false,
			matchedProperty,
			reason: getUnsafeMatchReason(classification.fieldIntent),
			requiresReview: true,
		});
	}

	const valueDecision = validateSensitiveFieldValue({
		intent: classification.fieldIntent,
		value: explicitReviewAnswer
			? getReviewAnswerSafetyValue(classification.fieldIntent, explicitReviewAnswer, field)
			: matchedProfileProperty.value,
		fieldType: field.kind,
		options: field.options || [],
		constraints: field.constraints || {},
		field,
	});
	if (!valueDecision.allowed) {
		return buildDecision({
			...classification,
			allowed: false,
			matchedProperty,
			reason: valueDecision.reason,
			requiresReview: true,
			valueCompatibility: valueDecision,
		});
	}

	return buildDecision({
		...classification,
		allowed: true,
		matchedProperty,
		reason: explicitReviewAnswer ? "explicit-user-review-value-approved" : "explicit-profile-value-approved",
		requiresReview: false,
		valueCompatibility: valueDecision,
	});
}

function getReviewAnswerSafetyValue(fieldIntent, reviewAnswer, field) {
	if (fieldIntent !== FIELD_INTENTS.LEGAL_DECLARATION && fieldIntent !== FIELD_INTENTS.PRIVACY_CONSENT) {
		return reviewAnswer.answer;
	}
	if (reviewAnswer.authorization) return reviewAnswer.authorization;

	const normalized = normalizeComparableText(reviewAnswer.answer);
	const authorized = reviewAnswer.answer === true || ["yes", "true", "y", "agree", "i agree"].includes(normalized);
	return {
		authorizationType: "consent",
		authorized,
		consentScope: fieldIntent === FIELD_INTENTS.PRIVACY_CONSENT ? "privacy-policy" : "legal-declaration",
		statementFingerprint: reviewAnswer.statementFingerprint || getStatementFingerprint(field, field.constraints || {}),
		authorizedAt: reviewAnswer.authorizedAt,
	};
}

function validateSensitiveFieldValue(input = {}) {
	const intent = input.intent || FIELD_INTENTS.LOW_RISK;
	const value = input.value;
	const field = input.field || {};
	const options = input.options || field.options || [];
	const constraints = input.constraints || field.constraints || {};
	const fieldType = input.fieldType || field.kind || "";
	const fieldText = collectFieldEvidence(field).map((item) => item.value).join(" ").toLowerCase();

	if (isEmptyValue(value)) {
		return buildValueDecision(false, "sensitive-field-empty-value");
	}

	if (intent === FIELD_INTENTS.LEGAL_DECLARATION || intent === FIELD_INTENTS.PRIVACY_CONSENT) {
		return validateConsentAuthorization({ intent, value, field, constraints });
	}

	if (isOptionField(fieldType, options) && !matchesAvailableOption(value, options)) {
		return buildValueDecision(false, "sensitive-field-option-not-available");
	}

	if (requiresBooleanAnswer({ intent, fieldType, options, fieldText }) && !isBooleanCompatible(value)) {
		return buildValueDecision(false, "sensitive-field-value-format-mismatch");
	}

	if (intent === FIELD_INTENTS.WORK_AUTHORIZATION && !isBooleanQuestion(fieldText, options) && !isWorkEligibilityStatusCompatible(value)) {
		return buildValueDecision(false, "sensitive-field-value-format-mismatch");
	}

	if (isSalaryIntent(intent)) {
		const salaryDecision = validateSalaryValue({ value, fieldText, field, constraints });
		if (!salaryDecision.allowed) return salaryDecision;
	}

	return buildValueDecision(true, "sensitive-field-value-compatible");
}

function validateSalaryValue(input) {
	const valueText = normalizeText(input.value).toLowerCase();
	const constraints = input.constraints || {};
	const field = input.field || {};
	const fieldText = input.fieldText || "";

	if (requiresNumericValue(field, constraints, fieldText) && !hasNumericValue(valueText)) {
		return buildValueDecision(false, "sensitive-field-value-format-mismatch");
	}

	const fieldRequiresHourly = Boolean(constraints.period === "hourly" || /\b(hourly|per\s+hour|\/\s*hour|\/\s*hr|hourly\s+rate)\b/.test(fieldText));
	if (fieldRequiresHourly && looksAnnualSalaryValue(valueText)) {
		return buildValueDecision(false, "sensitive-field-value-format-mismatch");
	}

	if (constraints.requiresCurrency && !hasCurrency(valueText)) {
		return buildValueDecision(false, "sensitive-field-ambiguous-value");
	}

	if (constraints.requiresPeriod && !hasSalaryPeriod(valueText)) {
		return buildValueDecision(false, "sensitive-field-ambiguous-value");
	}

	return buildValueDecision(true, "sensitive-field-value-compatible");
}

function validateConsentAuthorization(input) {
	const authorization = input.value;
	if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) {
		return buildValueDecision(false, "legal-consent-requires-current-statement-authorization");
	}

	const expectedFingerprint = getStatementFingerprint(input.field, input.constraints);
	const expectedScope = input.intent === FIELD_INTENTS.PRIVACY_CONSENT ? "privacy-policy" : "legal-declaration";
	if (authorization.authorizationType !== "consent" || authorization.authorized !== true) {
		return buildValueDecision(false, "legal-consent-requires-current-statement-authorization");
	}
	if (authorization.consentScope !== expectedScope) {
		return buildValueDecision(false, "legal-consent-requires-current-statement-authorization");
	}
	if (!expectedFingerprint || authorization.statementFingerprint !== expectedFingerprint) {
		return buildValueDecision(false, "legal-consent-requires-current-statement-authorization");
	}
	if (!authorization.authorizedAt) {
		return buildValueDecision(false, "legal-consent-requires-current-statement-authorization");
	}

	return buildValueDecision(true, "sensitive-field-value-compatible");
}

function isProfilePropertyAllowed(fieldIntent, propertyPath) {
	const allowedKeys = ALLOWED_PROFILE_KEYS_BY_INTENT[fieldIntent];
	if (!allowedKeys || !allowedKeys.size) return false;
	return allowedKeys.has(getPropertyKey(propertyPath));
}

function getPropertyKey(propertyPath) {
	const segments = String(propertyPath || "").split(".").filter(Boolean);
	return segments[segments.length - 1] || "";
}

function getNoExplicitValueReason(fieldIntent) {
	if (fieldIntent === FIELD_INTENTS.SALARY_EXPECTATION) return "salary-expectation-requires-explicit-answer";
	if (fieldIntent === FIELD_INTENTS.LEGAL_DECLARATION || fieldIntent === FIELD_INTENTS.PRIVACY_CONSENT) {
		return "legal-consent-requires-user-review";
	}
	return "sensitive-field-no-explicit-profile-value";
}

function getUnsafeMatchReason(fieldIntent) {
	if (fieldIntent === FIELD_INTENTS.LEGAL_DECLARATION || fieldIntent === FIELD_INTENTS.PRIVACY_CONSENT) {
		return "legal-consent-requires-user-review";
	}
	return "sensitive-field-unsafe-profile-match";
}

function buildDecision(input) {
	return {
		allowed: input.allowed,
		fieldIntent: input.fieldIntent,
		riskLevel: input.riskLevel,
		matchedProperty: input.matchedProperty,
		reason: input.reason,
		requiresReview: input.requiresReview,
		evidence: input.evidence || [],
		valueCompatibility: input.valueCompatibility,
	};
}

function buildValueDecision(allowed, reason) {
	return {
		allowed,
		reason,
	};
}

function collectFieldEvidence(field = {}) {
	const evidence = [];

	addEvidence(evidence, "label", field.label && field.label.text);
	for (const candidate of field.labelCandidates || []) {
		addEvidence(evidence, candidate.source || "label-candidate", candidate.text);
	}
	addEvidence(evidence, "placeholder", field.placeholder);
	for (const option of field.options || []) {
		addEvidence(evidence, "option", option && (option.label || option.value));
	}
	addEvidence(evidence, "visible-text", field.evidence && field.evidence.visibleText);
	for (const semanticItem of collectSemanticEvidence(field)) {
		addEvidence(evidence, semanticItem.source, semanticItem.value);
	}

	return dedupeEvidence(evidence);
}

function collectSemanticEvidence(field) {
	const semanticEvidence = [];

	for (const pathItem of field.semanticPath || []) {
		addEvidence(semanticEvidence, "semantic-path", pathItem && pathItem.label);
		addEvidence(semanticEvidence, "semantic-path", pathItem && pathItem.role);
	}

	if (field.semanticEvidence && typeof field.semanticEvidence === "object") {
		for (const [source, value] of Object.entries(field.semanticEvidence)) {
			if (Array.isArray(value)) {
				for (const item of value) addEvidence(semanticEvidence, `semantic-${source}`, item);
			} else {
				addEvidence(semanticEvidence, `semantic-${source}`, value);
			}
		}
	}

	return semanticEvidence;
}

function addEvidence(evidence, source, value) {
	const normalized = normalizeText(value);
	if (!normalized) return;
	evidence.push({ source, value: normalized });
}

function dedupeEvidence(evidence) {
	const seen = new Set();
	const result = [];

	for (const item of evidence) {
		const key = `${item.source}:${item.value.toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(item);
	}

	return result;
}

function normalizeText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function isEmptyValue(value) {
	if (value === undefined || value === null) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

function isOptionField(fieldType, options) {
	return fieldType === "radio" || fieldType === "selection" || (Array.isArray(options) && options.length > 0);
}

function matchesAvailableOption(value, options) {
	const optionTexts = (options || [])
		.filter((option) => !option.disabled)
		.flatMap((option) => [option.label, option.value])
		.map(normalizeComparableText)
		.filter(Boolean);
	if (!optionTexts.length) return true;

	return getValueOptionTexts(value).some((candidate) => optionTexts.includes(candidate));
}

function getValueOptionTexts(value) {
	if (typeof value === "boolean") return [value ? "yes" : "no", String(value)];
	return [normalizeComparableText(value)];
}

function normalizeComparableText(value) {
	return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function requiresBooleanAnswer(input) {
	if (input.intent === FIELD_INTENTS.SPONSORSHIP_REQUIRED) return true;
	if (input.intent === FIELD_INTENTS.WORK_AUTHORIZATION) return isBooleanQuestion(input.fieldText, input.options);
	if (input.fieldType === "checkbox") return true;

	const optionTexts = (input.options || []).map((option) => normalizeComparableText(option.label || option.value)).filter(Boolean);
	if (!optionTexts.length) return false;
	return optionTexts.every((text) => ["yes", "no", "true", "false", "y", "n"].includes(text));
}

function isBooleanQuestion(fieldText, options) {
	const optionTexts = (options || []).map((option) => normalizeComparableText(option.label || option.value)).filter(Boolean);
	if (optionTexts.length) return optionTexts.every((text) => ["yes", "no", "true", "false", "y", "n"].includes(text));
	return /\b(legally\s+authorized|authorized\s+to\s+work|eligible\s+to\s+work|right\s+to\s+work)\b/.test(fieldText);
}

function isWorkEligibilityStatusCompatible(value) {
	const normalized = normalizeComparableText(value);
	if (isBooleanCompatible(value)) return true;
	return /\b(citizen|permanent\s+resident|resident\s+visa|work\s+visa|open\s+work\s+visa|work\s+permit|visa)\b/.test(normalized);
}

function isBooleanCompatible(value) {
	if (typeof value === "boolean") return true;
	const normalized = normalizeComparableText(value);
	return ["yes", "no", "true", "false", "y", "n"].includes(normalized);
}

function isSalaryIntent(intent) {
	return intent === FIELD_INTENTS.SALARY_EXPECTATION || intent === FIELD_INTENTS.CURRENT_SALARY;
}

function requiresNumericValue(field, constraints, fieldText) {
	if (constraints.numericOnly || constraints.format === "numeric") return true;
	if (String(field.inputType || "").toLowerCase() === "number") return true;
	return /\b(numbers?\s+only|numeric\s+only|enter\s+(a\s+)?number|amount)\b/.test(fieldText);
}

function hasNumericValue(valueText) {
	return /\d/.test(valueText);
}

function looksAnnualSalaryValue(valueText) {
	if (/\b(annual|annually|yearly|per\s+year|\/\s*year|\/\s*yr|pa|p\.a\.)\b/.test(valueText)) return true;
	const numericParts = valueText.match(/\d[\d,.]*/g) || [];
	return numericParts.some((part) => {
		const parsed = Number(part.replace(/,/g, ""));
		return Number.isFinite(parsed) && parsed >= 1000;
	});
}

function hasCurrency(valueText) {
	return /[$€£¥₹]|(?:\b(?:usd|nzd|aud|cad|eur|gbp|jpy|inr)\b)/i.test(valueText);
}

function hasSalaryPeriod(valueText) {
	return /\b(hourly|per\s+hour|\/\s*hour|\/\s*hr|annual|annually|yearly|per\s+year|\/\s*year|\/\s*yr|pa|p\.a\.)\b/.test(valueText);
}

function getStatementFingerprint(field, constraints) {
	return constraints.statementFingerprint
		|| field.statementFingerprint
		|| field.consentStatementFingerprint
		|| field.evidence && field.evidence.statementFingerprint
		|| buildFallbackStatementFingerprint(field)
		|| "";
}

function buildFallbackStatementFingerprint(field = {}) {
	return buildFieldFingerprint(field);
}

module.exports = {
	FIELD_INTENTS,
	classifyFieldIntent,
	evaluateFieldAnswerSafety,
	validateSensitiveFieldValue,
	collectFieldEvidence,
};
