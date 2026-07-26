const assert = require("node:assert/strict");

const { classifyFieldIntent, evaluateFieldAnswerSafety, validateSensitiveFieldValue } = require("./field-answer-safety");
const { matchFieldsToProfile } = require("./field-matching");
const { buildFieldFingerprint, buildReviewAnswer } = require("../review/review-resolution");

const semanticPage = {
	interactiveElements: [
		createField("interactive-1", "text-input", "First name", "label", 0.98),
		createField("interactive-2", "checkbox", "I agree", "label", 0.98, "checkbox"),
		createField("interactive-3", "selection", "Country", "aria-label", 0.94),
		createField("interactive-4", "button", "Continue", "visible-text", 0.9, "button"),
	],
};

const profile = {
	firstName: "Aroha",
	lastName: "Smith",
	email: "aroha@example.com",
	country: "New Zealand",
	agreement: true,
};

const matches = matchFieldsToProfile(semanticPage, profile);

assert.deepEqual(
	matches.map((match) => ({
		field: match.field.label.text,
		property: match.matchedProfileProperty && match.matchedProfileProperty.path,
		confidence: match.confidenceScore,
		intent: match.fieldAnswerSafety.fieldIntent,
	})),
	[
		{ field: "First name", property: "firstName", confidence: 98, intent: "low-risk" },
		{ field: "I agree", property: "agreement", confidence: 90, intent: "low-risk" },
		{ field: "Country", property: "country", confidence: 100, intent: "low-risk" },
	],
);

assertIntent("What are your salary expectations?", "salary-expectation");
assertIntent("Desired hourly rate", "salary-expectation");
assertIntent("Current salary", "current-salary");
assertIntent("Are you legally authorized to work in the United States?", "work-authorization");
assertIntent("Will you now or in the future require visa sponsorship?", "sponsorship-required");
assertIntent("Visa type", "visa-type");
assertIntent("I certify that the information provided is true and complete", "legal-declaration");
assertIntent("I confirm that the information provided is accurate", "legal-declaration");
assert.equal(classifyFieldIntent(createField("confirm-email", "text-input", "Confirm Email", "label", 0.98)).fieldIntent, "low-risk");
assertIntent("I agree to the privacy policy", "privacy-consent");
assertIntent("How did you hear about us?", "referral-source");
assertIntent("Referral source", "referral-source");

for (const label of ["First name", "Email address", "City", "Country"]) {
	const decision = classifyFieldIntent(createField("safe", "text-input", label, "label", 0.98));
	assert.equal(decision.fieldIntent, "low-risk");
	assert.equal(decision.riskLevel, "low");
	assert.equal(decision.reason, "low-risk-field");
}

const semanticEvidenceDecision = classifyFieldIntent({
	...createField("semantic", "text-input", "", "label", 0),
	semanticEvidence: {
		sectionHeading: "Compensation",
		nearbyText: ["Expected pay"],
	},
});
assert.equal(semanticEvidenceDecision.fieldIntent, "salary-expectation");
assert.deepEqual(
	semanticEvidenceDecision.evidence.map((item) => item.source),
	["semantic-sectionHeading", "semantic-nearbyText"],
);

const unsafeSalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("salary", "text-input", "What are your salary expectations?", "label", 0.98),
	],
}, {
	targetRole: "Full-Stack Engineer",
	jobTitle: "Software Engineer",
	summary: "Full-stack product engineer",
}, { threshold: 1 });
assert.equal(unsafeSalaryMatches[0].matchedProfileProperty, null);
assert.equal(unsafeSalaryMatches[0].safetyDecision.allowed, false);
assert.equal(unsafeSalaryMatches[0].safetyDecision.fieldIntent, "salary-expectation");
assert.equal(unsafeSalaryMatches[0].safetyDecision.reason, "salary-expectation-requires-explicit-answer");

const unsafeSalaryDecision = evaluateFieldAnswerSafety(
	createField("salary", "text-input", "What are your salary expectations?", "label", 0.98),
	{ path: "targetRole", value: "Full-Stack Engineer", valueType: "string", valuePresent: true },
);
assert.equal(unsafeSalaryDecision.allowed, false);
assert.equal(unsafeSalaryDecision.reason, "sensitive-field-unsafe-profile-match");

const missingSalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("salary", "text-input", "Salary expectations", "label", 0.98),
	],
}, {
	firstName: "Aroha",
}, { threshold: 80 });
assert.equal(missingSalaryMatches[0].matchedProfileProperty, null);
assert.equal(missingSalaryMatches[0].safetyDecision.reason, "salary-expectation-requires-explicit-answer");

const explicitSalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("salary", "text-input", "Salary expectations", "label", 0.98),
	],
}, {
	salaryExpectation: "NZD 150,000",
	targetRole: "Full-Stack Engineer",
});
assert.equal(explicitSalaryMatches[0].matchedProfileProperty.path, "salaryExpectation");
assert.equal(explicitSalaryMatches[0].safetyDecision.allowed, true);
assert.equal(explicitSalaryMatches[0].safetyDecision.reason, "explicit-profile-value-approved");
assert.equal(explicitSalaryMatches[0].safetyDecision.valueCompatibility.allowed, true);

const numericOnlySalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("salary", "text-input", "Salary expectations", "label", 0.98, "number", { numericOnly: true }),
	],
}, {
	salaryExpectation: "Negotiable",
});
assert.equal(numericOnlySalaryMatches[0].matchedProfileProperty, null);
assert.equal(numericOnlySalaryMatches[0].safetyDecision.reason, "sensitive-field-value-format-mismatch");
assert.equal(numericOnlySalaryMatches[0].safetyDecision.valueCompatibility.reason, "sensitive-field-value-format-mismatch");

const hourlySalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("hourly", "text-input", "Desired hourly rate", "label", 0.98),
	],
}, {
	salaryExpectation: "NZD 150,000 annually",
});
assert.equal(hourlySalaryMatches[0].matchedProfileProperty, null);
assert.equal(hourlySalaryMatches[0].safetyDecision.reason, "sensitive-field-value-format-mismatch");

const salaryOptionMismatchMatches = matchFieldsToProfile({
	interactiveElements: [
		{
			...createField("salary-options", "selection", "Salary expectations", "label", 0.98),
			options: [{ label: "NZD 120,000" }, { label: "NZD 150,000" }],
		},
	],
}, {
	salaryExpectation: "NZD 200,000",
});
assert.equal(salaryOptionMismatchMatches[0].matchedProfileProperty, null);
assert.equal(salaryOptionMismatchMatches[0].safetyDecision.reason, "sensitive-field-option-not-available");

const salaryAmbiguityDecision = evaluateFieldAnswerSafety(
	createField("salary", "text-input", "Salary expectations", "label", 0.98, "text", { requiresCurrency: true, requiresPeriod: true }),
	{ path: "salaryExpectation", value: "150000", valueType: "string", valuePresent: true },
);
assert.equal(salaryAmbiguityDecision.allowed, false);
assert.equal(salaryAmbiguityDecision.reason, "sensitive-field-ambiguous-value");

const currentSalaryMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("current-salary", "text-input", "Current salary", "label", 0.98),
	],
}, {
	salaryExpectation: "NZD 150,000",
}, { threshold: 1 });
assert.equal(currentSalaryMatches[0].matchedProfileProperty, null);
assert.equal(currentSalaryMatches[0].safetyDecision.fieldIntent, "current-salary");
assert.equal(currentSalaryMatches[0].safetyDecision.reason, "sensitive-field-unsafe-profile-match");

const workAuthorizationMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("work-auth", "radio", "Are you legally authorized to work in this country?", "label", 0.98, "radio"),
	],
}, {
	requiresSponsorship: false,
	workAuthorization: true,
});
assert.equal(workAuthorizationMatches[0].matchedProfileProperty.path, "workAuthorization");
assert.equal(workAuthorizationMatches[0].safetyDecision.allowed, true);

const workAuthorizationOptionMismatch = matchFieldsToProfile({
	interactiveElements: [
		{
			...createField("work-auth-options", "radio", "Are you legally authorized to work in this country?", "label", 0.98, "radio"),
			options: [{ label: "No" }],
		},
	],
}, {
	workAuthorization: true,
});
assert.equal(workAuthorizationOptionMismatch[0].matchedProfileProperty, null);
assert.equal(workAuthorizationOptionMismatch[0].safetyDecision.reason, "sensitive-field-option-not-available");

const booleanMismatchDecision = evaluateFieldAnswerSafety(
	createField("work-auth", "radio", "Are you legally authorized to work in this country?", "label", 0.98, "radio"),
	{ path: "workAuthorization", value: "Maybe", valueType: "string", valuePresent: true },
);
assert.equal(booleanMismatchDecision.allowed, false);
assert.equal(booleanMismatchDecision.reason, "sensitive-field-value-format-mismatch");

const workEligibilityStatusDecision = evaluateFieldAnswerSafety(
	createField("work-eligibility", "text-input", "Work Eligibility*", "label", 0.98),
	{ path: "workAuthorization", value: "Citizen or Permanent Resident Visa", valueType: "string", valuePresent: true },
);
assert.equal(workEligibilityStatusDecision.allowed, true);
assert.equal(workEligibilityStatusDecision.reason, "explicit-profile-value-approved");

const deterministicWorkEligibilityMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("work-eligibility", "text-input", "Work Eligibility*", "label", 0.98),
	],
}, {
	workAuthorization: "New Zealand Permanent Resident visa",
}, { threshold: 1 });
assert.equal(deterministicWorkEligibilityMatches[0].matchedProfileProperty.path, "workAuthorization");
assert.equal(deterministicWorkEligibilityMatches[0].matchedProfileProperty.value, "Citizen or Permanent Resident Visa");
assert.equal(deterministicWorkEligibilityMatches[0].matchedProfileProperty.source, "deterministic-work-eligibility");
assert.equal(deterministicWorkEligibilityMatches[0].safetyDecision.allowed, true);

const deterministicObservedWorkEligibilityMatches = matchFieldsToProfile({
	interactiveElements: [
		{
			...createField("work-eligibility-options", "selection", "Work Eligibility*", "label", 0.98),
			options: [
				{ label: "Citizen or Permanent Resident" },
				{ label: "Work Visa" },
				{ label: "Not currently eligible to work" },
			],
		},
	],
}, {
	workAuthorization: "New Zealand Permanent Resident visa",
}, { threshold: 1 });
assert.equal(deterministicObservedWorkEligibilityMatches[0].matchedProfileProperty.path, "workAuthorization");
assert.equal(deterministicObservedWorkEligibilityMatches[0].matchedProfileProperty.value, "Citizen or Permanent Resident");
assert.equal(deterministicObservedWorkEligibilityMatches[0].safetyDecision.allowed, true);

const booleanWorkEligibilityMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("work-auth", "radio", "Are you legally authorized to work in New Zealand?", "label", 0.98, "radio"),
	],
}, {
	workAuthorization: "New Zealand Permanent Resident visa",
}, { threshold: 1 });
assert.equal(booleanWorkEligibilityMatches[0].matchedProfileProperty.value, "Yes");
assert.equal(booleanWorkEligibilityMatches[0].safetyDecision.allowed, true);

const structuredLocationMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("location-city", "text-input", "Location (City)*", "label", 0.98),
		createField("country", "text-input", "Country*", "label", 0.98),
		createField("city-country", "text-input", "Current location", "label", 0.98),
		createField("resume", "file-upload", "Resume", "label", 0.98, "file"),
	],
}, {
	location: {
		city: "Wellington",
		country: "New Zealand",
		formatted: "Wellington, New Zealand",
	},
	city: "Auckland",
	country: "Australia",
}, { threshold: 1 });
assert.equal(structuredLocationMatches[0].matchedProfileProperty.path, "location.city");
assert.equal(structuredLocationMatches[0].matchedProfileProperty.value, "Wellington");
assert.equal(structuredLocationMatches[1].matchedProfileProperty.path, "location.country");
assert.equal(structuredLocationMatches[1].matchedProfileProperty.value, "New Zealand");
assert.equal(structuredLocationMatches[2].matchedProfileProperty.path, "location.formatted");
assert.equal(structuredLocationMatches[2].matchedProfileProperty.value, "Wellington, New Zealand");
assert.notEqual(structuredLocationMatches[3].matchedProfileProperty && structuredLocationMatches[3].matchedProfileProperty.source, "structured-location");

const observedRegionFromCity = matchFieldsToProfile({
	interactiveElements: [{
		...createField("region", "selection", "State/Region", "label", 0.98),
		options: [{ label: "Auckland" }, { label: "Wellington" }],
	}],
}, {
	city: "Auckland",
	country: "New Zealand",
	skills: { ai: "OpenAI GPT-4" },
}, { threshold: 1 });
assert.equal(observedRegionFromCity[0].matchedProfileProperty.path, "city");
assert.equal(observedRegionFromCity[0].matchedProfileProperty.value, "Auckland");
assert.equal(observedRegionFromCity[0].matchedProfileProperty.source, "structured-location-observed-option");

const unresolvedRegionDoesNotUseUnrelatedProfileValue = matchFieldsToProfile({
	interactiveElements: [{
		...createField("region", "selection", "State/Region", "label", 0.98),
		options: [{ label: "Wellington" }],
	}],
}, {
	city: "Auckland",
	skills: { ai: "OpenAI GPT-4" },
}, { threshold: 1 });
assert.equal(unresolvedRegionDoesNotUseUnrelatedProfileValue[0].matchedProfileProperty, null);

const structuredPhoneMatches = matchFieldsToProfile({
	interactiveElements: [
		{ ...createField("phone-country", "text-input", "Mobile", "label", 0.98), name: "day_phone_country" },
		{ ...createField("phone-number", "text-input", "Mobile", "label", 0.98), name: "day_phone" },
		{ ...createField("after-hours", "text-input", "A/H", "label", 0.98), name: "ah_phone" },
	],
}, {
	phone: "+64 021-024-81775",
}, { threshold: 1 });
assert.equal(structuredPhoneMatches[0].matchedProfileProperty.value, "64");
assert.equal(structuredPhoneMatches[0].matchedProfileProperty.source, "structured-phone");
assert.equal(structuredPhoneMatches[1].matchedProfileProperty.value, "02102481775");
assert.equal(structuredPhoneMatches[1].matchedProfileProperty.source, "structured-phone");
assert.equal(structuredPhoneMatches[2].matchedProfileProperty, null);

const degreeCheckboxesDoNotCoerceTextToBoolean = matchFieldsToProfile({
	interactiveElements: [
		createField("masters", "checkbox", "Masters Degree", "label", 0.98, "checkbox"),
		createField("postgraduate", "checkbox", "Post Graduate Degree", "label", 0.98, "checkbox"),
		createField("undergraduate", "checkbox", "Under Graduate Degree", "label", 0.98, "checkbox"),
	],
}, {
	education: { degree: "Bachelor of Science" },
}, { threshold: 1 });
assert.equal(degreeCheckboxesDoNotCoerceTextToBoolean.every((match) => match.matchedProfileProperty === null), true);

const unsafeWorkAuthorizationMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("work-auth", "radio", "Are you legally authorized to work in this country?", "label", 0.98, "radio"),
	],
}, {
	requiresSponsorship: false,
}, { threshold: 1 });
assert.equal(unsafeWorkAuthorizationMatches[0].matchedProfileProperty, null);
assert.equal(unsafeWorkAuthorizationMatches[0].safetyDecision.reason, "sensitive-field-no-explicit-profile-value");

const unsafeWorkAuthorizationDecision = evaluateFieldAnswerSafety(
	createField("work-auth", "radio", "Are you legally authorized to work in this country?", "label", 0.98, "radio"),
	{ path: "requiresSponsorship", value: false, valueType: "boolean", valuePresent: true },
);
assert.equal(unsafeWorkAuthorizationDecision.allowed, false);
assert.equal(unsafeWorkAuthorizationDecision.reason, "sensitive-field-unsafe-profile-match");

const sponsorshipMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("sponsorship", "radio", "Will you require visa sponsorship?", "label", 0.98, "radio"),
	],
}, {
	workAuthorization: true,
}, { threshold: 1 });
assert.equal(sponsorshipMatches[0].matchedProfileProperty, null);
assert.equal(sponsorshipMatches[0].safetyDecision.fieldIntent, "sponsorship-required");
assert.equal(sponsorshipMatches[0].safetyDecision.reason, "sensitive-field-no-explicit-profile-value");

const unsafeSponsorshipDecision = evaluateFieldAnswerSafety(
	createField("sponsorship", "radio", "Will you require visa sponsorship?", "label", 0.98, "radio"),
	{ path: "workAuthorization", value: true, valueType: "boolean", valuePresent: true },
);
assert.equal(unsafeSponsorshipDecision.allowed, false);
assert.equal(unsafeSponsorshipDecision.reason, "sensitive-field-unsafe-profile-match");

const privacyConsentMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("privacy", "checkbox", "I agree to the privacy policy", "label", 0.98, "checkbox"),
	],
}, {
	acceptsPrivacyPolicy: true,
	agreement: true,
}, { threshold: 1 });
assert.equal(privacyConsentMatches[0].matchedProfileProperty, null);
assert.equal(privacyConsentMatches[0].safetyDecision.reason, "legal-consent-requires-user-review");

const broadConsentDecision = evaluateFieldAnswerSafety(
	createField("privacy", "checkbox", "I agree to the privacy policy", "label", 0.98, "checkbox"),
	{ path: "consentAuthorization", value: true, valueType: "boolean", valuePresent: true },
);
assert.equal(broadConsentDecision.allowed, false);
assert.equal(broadConsentDecision.reason, "legal-consent-requires-current-statement-authorization");

const exactConsentField = createField("privacy", "checkbox", "I agree to the privacy policy", "label", 0.98, "checkbox", {
	statementFingerprint: "privacy-v1",
});
const exactConsentDecision = evaluateFieldAnswerSafety(
	exactConsentField,
	{
		path: "consentAuthorization",
		value: {
			authorizationType: "consent",
			consentScope: "privacy-policy",
			statementFingerprint: "privacy-v1",
			authorized: true,
			authorizedAt: "2026-07-20T00:00:00.000Z",
		},
		valueType: "object",
		valuePresent: true,
	},
);
assert.equal(exactConsentDecision.allowed, true);
assert.equal(exactConsentDecision.reason, "explicit-profile-value-approved");

assert.equal(validateSensitiveFieldValue({
	intent: "salary-expectation",
	value: "",
	field: createField("salary", "text-input", "Salary expectations", "label", 0.98),
}).reason, "sensitive-field-empty-value");

const referralMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("source", "text-input", "How did you hear about us?", "label", 0.98),
	],
}, {
	source: "resume-import.json",
}, { threshold: 1 });
assert.equal(referralMatches[0].matchedProfileProperty, null);
assert.equal(referralMatches[0].safetyDecision.fieldIntent, "referral-source");
assert.equal(referralMatches[0].safetyDecision.reason, "sensitive-field-no-explicit-profile-value");

const unsafeReferralDecision = evaluateFieldAnswerSafety(
	createField("source", "text-input", "Source", "label", 0.98),
	{ path: "source", value: "resume-import.json", valueType: "string", valuePresent: true },
);
assert.equal(unsafeReferralDecision.allowed, false);
assert.equal(unsafeReferralDecision.reason, "sensitive-field-unsafe-profile-match");

const referralCheckboxMatches = matchFieldsToProfile({
	interactiveElements: [
		createField("ref-1", "checkbox", "Re-Leased employee referral", "label", 0.98, "checkbox"),
		createField("ref-2", "checkbox", "Industry referral", "label", 0.98, "checkbox"),
		createField("ref-3", "checkbox", "Seek", "label", 0.98, "checkbox"),
	],
}, {}, { threshold: 1 });
assert.equal(referralCheckboxMatches.length, 1);
assert.equal(referralCheckboxMatches[0].field.label.text, "Re-Leased employee referral");
assert.equal(referralCheckboxMatches[0].matchedProfileProperty.path, "referralSource");
assert.equal(referralCheckboxMatches[0].matchedProfileProperty.source, "default-first-referral-source-option");
assert.equal(referralCheckboxMatches[0].matchedProfileProperty.value, true);
assert.equal(referralCheckboxMatches[0].safetyDecision.allowed, true);

const workAuthorizationField = {
	...createField("work-auth", "radio", "Are you legally authorized to work in New Zealand?", "label", 0.98),
	required: true,
	options: [{ label: "Yes" }, { label: "No" }],
};
const reviewAnswer = buildReviewAnswer({
	fieldIntent: "work-authorization",
	fieldFingerprint: buildFieldFingerprint(workAuthorizationField),
	fieldId: "work-auth",
	fieldLabel: { text: "Are you legally authorized to work in New Zealand?", source: "label" },
	answer: "Yes",
	answerType: "selection",
	safetyReasonResolved: "sensitive-field-value-format-mismatch",
	optionsSnapshot: [{ label: "Yes" }, { label: "No" }],
}, new Date("2026-07-20T00:00:00.000Z"));
const reviewResolvedMatches = matchFieldsToProfile({
	interactiveElements: [workAuthorizationField],
}, {
	workAuthorization: "Open work visa valid until 2027",
}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [reviewAnswer] },
});
assert.equal(reviewResolvedMatches[0].matchedProfileProperty.source, "explicit-user-review");
assert.equal(reviewResolvedMatches[0].matchedProfileProperty.value, "Yes");
assert.equal(reviewResolvedMatches[0].safetyDecision.allowed, true);
assert.equal(reviewResolvedMatches[0].safetyDecision.reason, "explicit-user-review-value-approved");

const reviewedLocationField = {
	...createField("candidate-location", "selection", "Location (City)*", "label", 0.98),
	required: true,
	role: "combobox",
	domId: "candidate-location",
	options: [
		{ label: "Auckland, Auckland Region, New Zealand" },
		{ label: "Auckland Airport, Auckland Region, New Zealand" },
	],
};
const reviewedLocationAnswer = buildReviewAnswer({
	fieldIntent: "low-risk",
	fieldFingerprint: buildFieldFingerprint(reviewedLocationField),
	fieldId: reviewedLocationField.id,
	fieldLabel: reviewedLocationField.label,
	answer: "Auckland, Auckland Region, New Zealand",
	answerType: "selection",
	safetyReasonResolved: "multiple-controlled-equivalence-candidates",
	optionsSnapshot: reviewedLocationField.options,
}, new Date("2026-07-24T00:00:00.000Z"));
const reviewedLocationMatches = matchFieldsToProfile({
	interactiveElements: [reviewedLocationField],
}, {
	city: "Auckland",
	country: "New Zealand",
}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [reviewedLocationAnswer] },
});
assert.equal(reviewedLocationMatches[0].matchedProfileProperty.source, "explicit-user-review");
assert.equal(reviewedLocationMatches[0].matchedProfileProperty.value, "Auckland, Auckland Region, New Zealand");

const differentFieldMatches = matchFieldsToProfile({
	interactiveElements: [{
		...workAuthorizationField,
		id: "work-auth-other",
		label: { text: "Are you authorized to work in Australia?", source: "label", confidence: 0.98 },
		labelCandidates: [{ text: "Are you authorized to work in Australia?", source: "label", confidence: 0.98 }],
	}],
}, {}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [reviewAnswer] },
});
assert.equal(differentFieldMatches[0].matchedProfileProperty, null);

const incompatibleReviewAnswer = buildReviewAnswer({
	fieldIntent: "work-authorization",
	fieldFingerprint: buildFieldFingerprint(workAuthorizationField),
	fieldId: "work-auth",
	fieldLabel: { text: "Are you legally authorized to work in New Zealand?", source: "label" },
	answer: "Maybe",
	answerType: "selection",
	safetyReasonResolved: "sensitive-field-value-format-mismatch",
	optionsSnapshot: [{ label: "Yes" }, { label: "No" }],
}, new Date("2026-07-20T00:00:00.000Z"));
const incompatibleReviewMatches = matchFieldsToProfile({
	interactiveElements: [workAuthorizationField],
}, {}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [incompatibleReviewAnswer] },
});
assert.equal(incompatibleReviewMatches[0].matchedProfileProperty, null);
assert.equal(incompatibleReviewMatches[0].safetyDecision.reason, "sensitive-field-option-not-available");

const privacyField = createField("privacy", "checkbox", "I agree to the privacy policy", "label", 0.98, "checkbox", {
	statementFingerprint: "privacy-current",
});
const staleConsentAnswer = buildReviewAnswer({
	fieldIntent: "privacy-consent",
	fieldFingerprint: buildFieldFingerprint(privacyField),
	fieldId: "privacy",
	fieldLabel: { text: "I agree to the privacy policy", source: "label" },
	answer: "Yes",
	answerType: "selection",
	safetyReasonResolved: "legal-consent-requires-user-review",
	statementFingerprint: "privacy-old",
}, new Date("2026-07-20T00:00:00.000Z"));
const staleConsentMatches = matchFieldsToProfile({
	interactiveElements: [privacyField],
}, {}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [staleConsentAnswer] },
});
assert.equal(staleConsentMatches[0].matchedProfileProperty, null);

const privacyFieldWithoutStatementFingerprint = createField("privacy-current-field", "text-input", "Re-Leased: Recruitment Privacy Policy*", "label", 0.98);
const currentConsentAnswer = buildReviewAnswer({
	fieldIntent: "privacy-consent",
	fieldFingerprint: buildFieldFingerprint(privacyFieldWithoutStatementFingerprint),
	fieldId: "privacy-current-field",
	fieldLabel: { text: "Re-Leased: Recruitment Privacy Policy*", source: "label" },
	answer: "Yes",
	answerType: "selection",
	safetyReasonResolved: "legal-consent-requires-user-review",
}, new Date("2026-07-20T00:00:00.000Z"));
const currentConsentMatches = matchFieldsToProfile({
	interactiveElements: [privacyFieldWithoutStatementFingerprint],
}, {}, {
	threshold: 1,
	runtimeState: { reviewAnswers: [currentConsentAnswer] },
});
assert.equal(currentConsentMatches[0].matchedProfileProperty.source, "explicit-user-review");
assert.equal(currentConsentMatches[0].safetyDecision.allowed, true);

function createField(id, kind, label, source, confidence, inputType = "", constraints = {}) {
	return {
		id,
		kind,
		inputType,
		required: false,
		disabled: false,
		readonly: false,
		label: { text: label, source, confidence },
		labelCandidates: [{ text: label, source, confidence }],
		options: [],
		constraints,
		evidence: { visibleText: kind === "button" ? label : "" },
	};
}

function assertIntent(label, expectedIntent) {
	const decision = classifyFieldIntent(createField(`field-${expectedIntent}`, "text-input", label, "label", 0.98));
	assert.equal(decision.fieldIntent, expectedIntent);
	assert.equal(decision.riskLevel, "high");
	assert.equal(decision.reason, "sensitive-field-intent-detected");
	assert.deepEqual(decision.evidence[0], { source: "label", value: label });
}
