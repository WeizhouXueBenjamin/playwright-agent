const { listProfileProperties } = require("../profile/profile-properties");
const { classifyFieldIntent, evaluateFieldAnswerSafety } = require("./field-answer-safety");
const { buildFieldFingerprint, createReviewAnswerProfileProperty, findReviewAnswerForField } = require("../review/review-resolution");
const { resolveLocationProfileProperty } = require("./location-resolution");
const { resolvePhoneProfileProperty } = require("./phone-resolution");
const { resolveWorkEligibilityProfileProperty } = require("./work-eligibility-resolution");
const { scoreTextMatch } = require("./text-similarity");

const MATCHABLE_KINDS = new Set(["text-input", "checkbox", "radio", "selection", "editable", "file-upload", "interactive"]);

function matchFieldsToProfile(semanticPage, profile, options = {}) {
	const threshold = options.threshold || 45;
	const profileProperties = listProfileProperties(profile);
	const matchableFields = getMatchableFields(semanticPage)
		.filter((field) => !isSkippedField(field, options.runtimeState || {}))
		.filter((field) => !isManuallyCompletedField(field, options.runtimeState || {}));
	const referralSourceDefaultFieldId = findDefaultReferralSourceFieldId(matchableFields);

	return matchableFields
		.filter((field) => !isIgnoredReferralSourceOption(field, referralSourceDefaultFieldId))
		.map((field) => {
		const fieldAnswerSafety = classifyFieldIntent(field);
		const defaultReferralMatch = matchDefaultReferralSourceOption(field, fieldAnswerSafety, referralSourceDefaultFieldId);
		if (defaultReferralMatch) return defaultReferralMatch;

		const reviewAnswerMatch = matchExplicitReviewAnswer(field, fieldAnswerSafety, options.runtimeState || {});
		if (reviewAnswerMatch) return reviewAnswerMatch;

		const deterministicMatch = matchDeterministicProfileValue(field, fieldAnswerSafety, profile);
		if (deterministicMatch) return deterministicMatch;

		const candidates = rankProfileCandidates(field, profileProperties);
		const bestCandidate = selectBestCandidate(field, candidates, threshold, fieldAnswerSafety);

		if (!bestCandidate || bestCandidate.confidenceScore < threshold) {
			const fallbackCandidate = selectRejectedCandidate(field, candidates, threshold, fieldAnswerSafety);
			const safetyDecision = evaluateFieldAnswerSafety(field, fallbackCandidate);
			const match = {
				field: describeField(field),
				fieldAnswerSafety,
				matchedProfileProperty: null,
				confidenceScore: 0,
				reasoning: safetyDecision.requiresReview
					? `Safety guard blocked this field: ${safetyDecision.reason}.`
					: "No profile property met the confidence threshold.",
				candidates: candidates.slice(0, 3),
			};
			if (fieldAnswerSafety.riskLevel === "high") match.safetyDecision = safetyDecision;
			return match;
		}

		const safetyDecision = evaluateFieldAnswerSafety(field, bestCandidate);
		const match = {
			field: describeField(field),
			fieldAnswerSafety,
			matchedProfileProperty: {
				path: bestCandidate.path,
				valueType: bestCandidate.valueType,
				valuePresent: bestCandidate.valuePresent,
				value: bestCandidate.value,
			},
			confidenceScore: bestCandidate.confidenceScore,
			reasoning: bestCandidate.reasoning,
			candidates: candidates.slice(0, 3),
		};
		if (fieldAnswerSafety.riskLevel === "high") match.safetyDecision = safetyDecision;
		return match;
	});
}

function isSkippedField(field, runtimeState) {
	const fingerprint = buildFieldFingerprint(field);
	return (runtimeState.skippedFields || []).some((skippedField) => {
		return skippedField.fieldFingerprint === fingerprint || skippedField.fieldId === field.id;
	});
}

function isManuallyCompletedField(field, runtimeState) {
	const fingerprint = buildFieldFingerprint(field);
	return (runtimeState.completedFields || []).some((completedField) => {
		return completedField.resolutionMethod === "manual"
			&& (completedField.fieldFingerprint === fingerprint || completedField.fieldId === field.id);
	});
}

function matchDeterministicProfileValue(field, fieldAnswerSafety, profile) {
	const candidate = resolveWorkEligibilityProfileProperty(field, profile)
		|| resolvePhoneProfileProperty(field, profile)
		|| resolveLocationProfileProperty(field, profile);
	if (!candidate) return null;
	if (!candidate.valuePresent) {
		if (fieldAnswerSafety.riskLevel === "high") return null;
		return {
			field: describeField(field),
			fieldAnswerSafety,
			matchedProfileProperty: null,
			confidenceScore: 0,
			reasoning: `No explicit structured value was available for ${candidate.path}.`,
			candidates: [],
		};
	}

	const safetyDecision = evaluateFieldAnswerSafety(field, candidate);
	const allowed = fieldAnswerSafety.riskLevel !== "high" || safetyDecision.allowed;

	return {
		field: describeField(field),
		fieldAnswerSafety,
		matchedProfileProperty: allowed
			? {
				path: candidate.path,
				valueType: candidate.valueType,
				valuePresent: candidate.valuePresent,
				value: candidate.value,
				source: candidate.source,
				selectionContext: candidate.selectionContext,
				requiresSponsorship: candidate.requiresSponsorship,
			}
			: null,
		confidenceScore: allowed ? 100 : 0,
		reasoning: allowed
			? `Resolved ${candidate.path} using deterministic ${candidate.source}.`
			: `Safety guard blocked deterministic value: ${safetyDecision.reason}.`,
		candidates: [],
		safetyDecision: fieldAnswerSafety.riskLevel === "high" ? safetyDecision : undefined,
	};
}

function matchDefaultReferralSourceOption(field, fieldAnswerSafety, referralSourceDefaultFieldId) {
	if (field.id !== referralSourceDefaultFieldId) return null;

	const candidate = {
		path: "referralSource",
		value: true,
		valueType: "boolean",
		valuePresent: true,
		source: "default-first-referral-source-option",
		scope: "current-run",
	};
	const safetyDecision = evaluateFieldAnswerSafety(field, candidate);

	return {
		field: describeField(field),
		fieldAnswerSafety,
		matchedProfileProperty: {
			path: candidate.path,
			valueType: candidate.valueType,
			valuePresent: candidate.valuePresent,
			value: candidate.value,
			source: candidate.source,
			scope: candidate.scope,
		},
		confidenceScore: 100,
		reasoning: "Selected the first referral-source option by configured product policy.",
		candidates: [],
		safetyDecision,
	};
}

function matchExplicitReviewAnswer(field, fieldAnswerSafety, runtimeState) {
	const reviewAnswer = findReviewAnswerForField(field, fieldAnswerSafety.fieldIntent, runtimeState);
	if (!reviewAnswer) return null;

	const candidate = createReviewAnswerProfileProperty(reviewAnswer);
	const safetyDecision = evaluateFieldAnswerSafety(field, candidate);
	const match = {
		field: describeField(field),
		fieldAnswerSafety,
		matchedProfileProperty: safetyDecision.allowed
			? {
				path: candidate.path,
				valueType: candidate.valueType,
				valuePresent: candidate.valuePresent,
				value: candidate.value,
				source: candidate.source,
				scope: candidate.scope,
				reviewAnswer,
			}
			: null,
		confidenceScore: safetyDecision.allowed ? 100 : 0,
		reasoning: safetyDecision.allowed
			? "Resolved by explicit run-scoped user review answer."
			: `Explicit review answer is incompatible: ${safetyDecision.reason}.`,
		candidates: [],
		safetyDecision,
	};

	return match;
}

function selectRejectedCandidate(field, candidates, threshold, fieldAnswerSafety) {
	if (fieldAnswerSafety.riskLevel !== "high") {
		return candidates.find((candidate) => candidate.confidenceScore >= threshold) || null;
	}

	const rejectedAllowedCandidate = candidates.find((candidate) => {
		if (candidate.confidenceScore < threshold) return false;
		const decision = evaluateFieldAnswerSafety(field, candidate);
		return !decision.allowed && decision.reason !== "sensitive-field-unsafe-profile-match";
	});

	return rejectedAllowedCandidate || candidates.find((candidate) => candidate.confidenceScore >= threshold) || null;
}

function selectBestCandidate(field, candidates, threshold, fieldAnswerSafety) {
	if (fieldAnswerSafety.riskLevel !== "high") {
		return candidates.find((candidate) => candidate.confidenceScore >= threshold && isControlCompatibleCandidate(field, candidate));
	}

	return candidates.find((candidate) => {
		if (candidate.confidenceScore < threshold) return false;
		if (!isControlCompatibleCandidate(field, candidate)) return false;
		return evaluateFieldAnswerSafety(field, candidate).allowed;
	});
}

function isControlCompatibleCandidate(field, candidate) {
	if (field.kind !== "checkbox") return true;
	return candidate.valueType === "boolean";
}

function getMatchableFields(semanticPage) {
	return (semanticPage.interactiveElements || []).filter((element) => {
		if (element.disabled || element.readonly) return false;
		if (["listbox", "option"].includes(element.role)) return false;
		if (!MATCHABLE_KINDS.has(element.kind)) return false;
		return element.kind !== "button" && element.kind !== "link";
	});
}


function findDefaultReferralSourceFieldId(fields) {
	const referralGroup = getReferralSourceCheckboxGroup(fields);
	return referralGroup.length ? referralGroup[0].id : "";
}

function isIgnoredReferralSourceOption(field, referralSourceDefaultFieldId) {
	if (!referralSourceDefaultFieldId) return false;
	if (field.id === referralSourceDefaultFieldId) return false;
	return isReferralSourceCheckboxOption(field);
}

function getReferralSourceCheckboxGroup(fields) {
	const group = fields.filter(isReferralSourceCheckboxOption);
	return group.length >= 2 ? group : [];
}

function isReferralSourceCheckboxOption(field) {
	if (!field || field.kind !== "checkbox") return false;
	const text = String(field.label && field.label.text || "").toLowerCase();
	if (!text) return false;
	return /\b(referral|referred|linkedin|indeed|seek|glassdoor|website|social media|job listing|inmail)\b/.test(text);
}

function rankProfileCandidates(field, profileProperties) {
	return profileProperties
		.map((property) => scoreCandidate(field, property))
		.sort((left, right) => right.confidenceScore - left.confidenceScore);
}

function scoreCandidate(field, property) {
	const fieldPhrases = getFieldPhrases(field);
	const phraseScores = [];

	for (const fieldPhrase of fieldPhrases) {
		for (const profilePhrase of property.searchPhrases) {
			phraseScores.push({
				fieldPhrase,
				profilePhrase,
				score: scoreTextMatch(fieldPhrase.text, profilePhrase) * fieldPhrase.weight,
			});
		}
	}

	const best = phraseScores.sort((left, right) => right.score - left.score)[0] || {
		fieldPhrase: { text: "", source: "none" },
		profilePhrase: "",
		score: 0,
	};

	return {
		path: property.path,
		value: property.value,
		valueType: property.valueType,
		valuePresent: property.valuePresent,
		confidenceScore: Math.round(best.score * 100),
		reasoning: `Matched field ${best.fieldPhrase.source} "${best.fieldPhrase.text}" to profile phrase "${best.profilePhrase}".`,
	};
}

function getFieldPhrases(field) {
	const phrases = [];

	addPhrase(phrases, field.label && field.label.text, "label", field.label ? field.label.confidence : 0);
	for (const candidate of field.labelCandidates || []) {
		addPhrase(phrases, candidate.text, candidate.source, candidate.confidence || 0.5);
	}
	addPhrase(phrases, field.placeholder, "placeholder", 0.72);
	addPhrase(phrases, field.evidence && field.evidence.visibleText, "visible-text", 0.7);
	addPhrase(phrases, (field.options || []).map((option) => option.label).join(" "), "options", 0.35);

	return dedupePhrases(phrases);
}

function addPhrase(phrases, text, source, weight) {
	const normalized = String(text || "").replace(/\s+/g, " ").trim();
	if (!normalized) return;
	phrases.push({ text: normalized, source, weight });
}

function dedupePhrases(phrases) {
	const seen = new Set();
	const result = [];

	for (const phrase of phrases) {
		const key = `${phrase.source}:${phrase.text.toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(phrase);
	}

	return result;
}

function describeField(field) {
	return {
		id: field.id,
		kind: field.kind,
		role: field.role || "",
		tagName: field.tagName || "",
		domId: field.domId || "",
		name: field.name || "",
		ariaLabelledBy: field.ariaLabelledBy || "",
		semanticPath: field.semanticPath || [],
		label: field.label,
		labelCandidates: field.labelCandidates || [],
		placeholder: field.placeholder || "",
		required: field.required,
		inputType: field.inputType,
		state: field.state || {},
		validation: field.validation || { valid: true, message: "" },
		options: field.options || [],
		constraints: field.constraints || {},
	};
}

module.exports = {
	matchFieldsToProfile,
};
