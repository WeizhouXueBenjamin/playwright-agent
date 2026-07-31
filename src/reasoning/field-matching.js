const { listProfileProperties } = require("../profile/profile-properties");
const { FIELD_INTENTS, classifyFieldIntent, evaluateFieldAnswerSafety } = require("./field-answer-safety");
const { buildFieldFingerprint, createReviewAnswerProfileProperty, findReviewAnswerForField } = require("../review/review-resolution");
const { resolveLocationProfileProperty } = require("./location-resolution");
const { resolvePhoneProfileProperty } = require("./phone-resolution");
const { resolveWorkEligibilityProfileProperty } = require("./work-eligibility-resolution");
const { normalizeOptionText, resolveOption } = require("../actions/option-resolver");
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
		if (defaultReferralMatch) return resolveChoiceGroupSelection(defaultReferralMatch);

		const reviewAnswerMatch = matchExplicitReviewAnswer(field, fieldAnswerSafety, options.runtimeState || {});
		if (reviewAnswerMatch) return resolveChoiceGroupSelection(reviewAnswerMatch);

		const deterministicMatch = matchDeterministicProfileValue(field, fieldAnswerSafety, profile);
		if (deterministicMatch) return resolveChoiceGroupSelection(deterministicMatch);

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
			return resolveChoiceGroupSelection(match);
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
		return resolveChoiceGroupSelection(match);
	});
}

function resolveChoiceGroupSelection(match) {
	const field = match && match.field || {};
	const group = field.choiceGroup;
	const property = match && match.matchedProfileProperty;
	if (!group || !property) return match;

	const requestedValues = Array.isArray(property.value) ? property.value : [property.value];
	if (group.mode === "multiple") {
		const controlledSource = property.source === "explicit-user-review"
			|| property.source === "default-first-referral-source-option";
		if (!controlledSource || !Array.isArray(property.value)) {
			return blockChoiceGroupMatch(match, "choice-group-multiple-requires-review");
		}
		const selections = requestedValues.map((value) => findExactGroupOption(field.options, value));
		if (selections.some((option) => !option)) return blockChoiceGroupMatch(match, "choice-group-option-not-available");
		return withResolvedChoiceGroupSelection(match, selections);
	}

	if (requestedValues.length !== 1) return blockChoiceGroupMatch(match, "choice-group-single-value-required");
	const resolution = resolveOption(field.options || [], requestedValues[0], {
		fieldIntent: match.fieldAnswerSafety && match.fieldAnswerSafety.fieldIntent,
		fieldLabel: field.label && field.label.text,
		profileProperty: property,
		selectionContext: property.selectionContext,
		requiresSponsorship: property.requiresSponsorship,
	});
	if (resolution.status !== "matched") return blockChoiceGroupMatch(match, resolution.reason || "choice-group-option-not-available");
	const selected = (field.options || []).find((option) => option.label === resolution.optionLabel);
	return selected ? withResolvedChoiceGroupSelection(match, [selected]) : blockChoiceGroupMatch(match, "choice-group-option-not-available");
}

function withResolvedChoiceGroupSelection(match, selections) {
	const value = match.field.choiceGroup.mode === "multiple"
		? selections.map((option) => option.label)
		: selections[0].label;
	const matchedProfileProperty = { ...match.matchedProfileProperty, value };
	const safetyDecision = match.fieldAnswerSafety && match.fieldAnswerSafety.riskLevel === "high"
		? evaluateFieldAnswerSafety(match.field, matchedProfileProperty)
		: match.safetyDecision;
	if (safetyDecision && !safetyDecision.allowed) {
		return { ...match, matchedProfileProperty: null, confidenceScore: 0, safetyDecision };
	}
	return {
		...match,
		matchedProfileProperty,
		choiceGroupSelection: selections.map((option) => option.fieldId),
		safetyDecision,
	};
}

function blockChoiceGroupMatch(match, reason) {
	const safetyDecision = match.fieldAnswerSafety && match.fieldAnswerSafety.riskLevel === "high"
		? { ...(match.safetyDecision || match.fieldAnswerSafety), allowed: false, requiresReview: true, reason }
		: match.safetyDecision;
	return {
		...match,
		matchedProfileProperty: null,
		confidenceScore: 0,
		reasoning: `Choice group requires review: ${reason}.`,
		safetyDecision,
	};
}

function findExactGroupOption(options, value) {
	const expected = normalizeOptionText(value);
	return (options || []).find((option) => normalizeOptionText(option.label) === expected) || null;
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
	if (field.choiceGroup && field.choiceGroup.mode === "multiple") return null;
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
	const groupedDefault = field.choiceGroup && field.options && field.options[0]
		? [field.options[0].label]
		: true;

	const candidate = {
		path: "referralSource",
		value: groupedDefault,
		valueType: Array.isArray(groupedDefault) ? "array" : "boolean",
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
	if (field.choiceGroup && field.choiceGroup.mode === "multiple") return false;
	if (field.kind !== "checkbox") return true;
	return candidate.valueType === "boolean";
}

function getMatchableFields(semanticPage) {
	const elements = semanticPage.interactiveElements || [];
	const groupedMemberIds = new Set((semanticPage.choiceGroups || []).flatMap((group) => group.memberIds || []));
	const fields = elements.filter((element) => !groupedMemberIds.has(element.id));
	for (const group of semanticPage.choiceGroups || []) {
		const field = buildChoiceGroupField(group, elements);
		if (field) fields.push(field);
	}
	return fields.filter((element) => {
		if (element.disabled || element.readonly) return false;
		if (["listbox", "option"].includes(element.role)) return false;
		if (!MATCHABLE_KINDS.has(element.kind)) return false;
		return element.kind !== "button" && element.kind !== "link";
	});
}

function buildChoiceGroupField(group, elements) {
	const memberById = new Map(elements.map((element) => [element.id, element]));
	const members = (group.memberIds || []).map((id) => memberById.get(id)).filter(Boolean);
	if (members.length < 2) return null;
	const question = String(group.question || "").trim();
	const first = members[0];
	const name = members.every((member) => member.name === first.name) ? first.name : "";
	return {
		id: group.id,
		kind: group.mode === "single" ? "radio" : "checkbox",
		role: group.mode === "single" ? "radiogroup" : "group",
		tagName: "",
		inputType: group.mode === "single" ? "radio" : "checkbox",
		label: {
			text: question || "Choice question",
			source: `choice-group-${group.rule}`,
			confidence: 1,
		},
		labelCandidates: question ? [{ text: question, source: `choice-group-${group.rule}`, confidence: 1 }] : [],
		placeholder: "",
		required: members.some((member) => member.required),
		disabled: members.every((member) => member.disabled),
		readonly: members.every((member) => member.readonly),
		state: {
			selectedLabels: members.filter((member) => member.state && member.state.checked).map((member) => member.label && member.label.text).filter(Boolean),
		},
		validation: {
			valid: members.every((member) => !member.validation || member.validation.valid !== false),
			message: members.map((member) => member.validation && member.validation.message).find(Boolean) || "",
		},
		options: members.map((member) => ({
			label: member.label && member.label.text || "",
			fieldId: member.id,
			domId: member.domId || "",
			name: member.name || "",
			value: member.value || "",
			role: member.role || "",
			kind: member.kind,
			disabled: member.disabled,
			checked: Boolean(member.state && member.state.checked),
		})).filter((option) => option.label),
		bounds: first.bounds,
		semanticPath: first.semanticPath || [],
		domId: "",
		name,
		ariaLabelledBy: "",
		choiceGroup: {
			id: group.id,
			mode: group.mode,
			rule: group.rule,
			memberIds: group.memberIds || [],
		},
		evidence: {
			visibleText: question,
			choiceGroupRule: group.rule,
		},
	};
}


function findDefaultReferralSourceFieldId(fields) {
	const groupedField = fields.find((field) => field.choiceGroup
		&& field.kind === "checkbox"
		&& classifyFieldIntent(field).fieldIntent === FIELD_INTENTS.REFERRAL_SOURCE);
	if (groupedField) return groupedField.id;
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
		value: field.value || "",
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
		choiceGroup: field.choiceGroup || null,
	};
}

module.exports = {
	matchFieldsToProfile,
};
