const TOKEN_SIMILARITY_THRESHOLD = 0.62;
const TOKEN_SIMILARITY_MIN_MARGIN = 0.18;
const MAX_REVIEW_CANDIDATES = 3;

function resolveOption(options, expectedLabel, context = {}) {
	const selectableOptions = normalizeOptions(options);
	if (!selectableOptions.length) {
		return buildUnmatchedResult("no-observed-option", selectableOptions, expectedLabel);
	}

	const canonical = findUniqueCandidate(selectableOptions, (option) => {
		return option.canonicalLabel === normalizeOptionText(expectedLabel)
			|| option.canonicalValue === normalizeOptionText(expectedLabel);
	});
	if (canonical.status === "matched") {
		const canonicalConflict = getSensitiveCanonicalConflict(selectableOptions, canonical.optionLabel, expectedLabel, context);
		if (canonicalConflict) return buildReviewResult(canonicalConflict, "canonical", selectableOptions, expectedLabel);
		return {
			...canonical,
			tier: "canonical",
			reason: "canonical-equality",
			candidates: rankTokenCandidates(selectableOptions, expectedLabel),
		};
	}
	if (canonical.status === "conflict") {
		return buildReviewResult("multiple-canonical-candidates", "canonical", selectableOptions, expectedLabel);
	}

	const workEligibility = findWorkEligibilityEquivalence(selectableOptions, expectedLabel, context);
	if (workEligibility.status) return workEligibility;

	const structural = findStructuralEquivalence(selectableOptions, expectedLabel, context);
	if (structural.status) return structural;

	const ranked = rankTokenCandidates(selectableOptions, expectedLabel);
	if (!ranked.length) return buildUnmatchedResult("no-token-candidates", selectableOptions, expectedLabel);
	const top = ranked[0];
	const second = ranked[1];
	if (top.score < TOKEN_SIMILARITY_THRESHOLD) {
		return { status: "no-match", tier: "none", optionLabel: "", candidates: ranked, reason: "below-similarity-threshold" };
	}
	if (second && top.score - second.score < TOKEN_SIMILARITY_MIN_MARGIN) {
		return { status: "needs-review", tier: "token-similarity", optionLabel: top.label, candidates: ranked, reason: "insufficient-score-margin" };
	}
	return { status: "needs-review", tier: "token-similarity", optionLabel: top.label, candidates: ranked, reason: "token-similarity-review-only" };
}

function getSensitiveCanonicalConflict(options, optionLabel, expectedLabel, context) {
	if (!isWorkEligibilityContext(context)) return "";
	const option = options.find((candidate) => candidate.label === optionLabel);
	if (!option) return "";
	const expectedDimensions = getWorkEligibilityDimensions(expectedLabel);
	if (context.requiresSponsorship !== undefined) expectedDimensions.sponsorshipRequired = context.requiresSponsorship;
	const candidateDimensions = getWorkEligibilityDimensions(`${option.label} ${option.value}`);
	return getWorkEligibilityConflict(expectedDimensions, candidateDimensions);
}

function normalizeOptionText(value) {
	let text = String(value || "");
	if (typeof text.normalize === "function") text = text.normalize("NFKC");
	return text
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/&/g, " and ")
		.replace(/[()[\]{}:;,.!?/\\|_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase()
		.replace(/^the\s+(.+)$/, "$1");
}

function tokenizeOptionText(value) {
	const canonical = normalizeOptionText(value);
	return canonical ? canonical.split(" ").filter(Boolean) : [];
}

function normalizeOptions(options) {
	return (options || [])
		.map((option) => ({
			...option,
			label: String(option && (option.label || option.text || "") || "").trim(),
			value: String(option && option.value || "").trim(),
			disabled: Boolean(option && option.disabled),
			placeholder: Boolean(option && option.placeholder),
		}))
		.filter((option) => option.label && !option.disabled && !option.placeholder)
		.map((option) => ({
			...option,
			canonicalLabel: normalizeOptionText(option.label),
			canonicalValue: normalizeOptionText(option.value),
		}));
}

function findStructuralEquivalence(options, expectedLabel, context) {
	const candidates = options.filter((option) => {
		return dialCodeSuffixMatch(option, expectedLabel, context)
			|| locationContextSuffixMatch(option, expectedLabel, context)
			|| cityDescriptorSuffixMatch(option, expectedLabel, context);
	});

	if (!candidates.length) return {};
	const contextual = narrowBySelectionContext(candidates, context.selectionContext);
	const viable = contextual.length ? contextual : candidates;
	if (viable.length !== 1) return buildReviewResult("multiple-controlled-equivalence-candidates", "controlled-equivalence", viable, expectedLabel);
	return {
		status: "matched",
		tier: "controlled-equivalence",
		optionLabel: viable[0].label,
		candidates: rankTokenCandidates(options, expectedLabel),
		reason: "structural-controlled-equivalence",
	};
}

function cityDescriptorSuffixMatch(option, expectedLabel, context = {}) {
	const fieldLabel = normalizeOptionText(context.fieldLabel);
	if (!/\b(city|suburb)\b/.test(fieldLabel)) return false;
	const expected = normalizeOptionText(expectedLabel);
	return Boolean(expected) && option.canonicalLabel === `${expected} city`;
}

function dialCodeSuffixMatch(option, expectedLabel, context = {}) {
	if (!isCountryOrPhoneCountryContext(context)) return false;
	const expected = normalizeOptionText(expectedLabel);
	if (!expected || !option.canonicalLabel.startsWith(`${expected} `)) return false;
	const suffix = option.label.slice(expectedLabel.length).trim();
	return /^\+?\d{1,4}$/.test(suffix);
}

function locationContextSuffixMatch(option, expectedLabel, context = {}) {
	const selectionContext = context.selectionContext || {};
	const country = normalizeOptionText(selectionContext.country);
	if (!country) return false;
	const expected = normalizeOptionText(expectedLabel);
	if (!expected || !option.canonicalLabel.startsWith(`${expected} `)) return false;
	return containsDelimitedTokenSequence(option.canonicalLabel, country);
}

function findWorkEligibilityEquivalence(options, expectedLabel, context) {
	if (!isWorkEligibilityContext(context)) return {};
	const expectedDimensions = getWorkEligibilityDimensions(expectedLabel);
	if (!hasKnownWorkEligibilityCategory(expectedDimensions)) return {};
	if (context.requiresSponsorship !== undefined) expectedDimensions.sponsorshipRequired = context.requiresSponsorship;

	const matches = [];
	let conflictReason = "";
	for (const option of options) {
		const candidateDimensions = getWorkEligibilityDimensions(`${option.label} ${option.value}`);
		const conflict = getWorkEligibilityConflict(expectedDimensions, candidateDimensions);
		if (conflict) {
			conflictReason = conflictReason || conflict;
			continue;
		}
		if (expectedDimensions.citizen && !candidateDimensions.citizen) continue;
		if (expectedDimensions.permanentResident && !candidateDimensions.permanentResident) continue;
		if (expectedDimensions.temporaryWorkRights && !candidateDimensions.temporaryWorkRights) continue;
		const residual = getWorkEligibilityResidualTokens(expectedLabel, option.label);
		if (residual.length) {
			conflictReason = "unknown-additional-status";
			continue;
		}
		matches.push(option);
	}

	if (!matches.length && conflictReason) return buildReviewResult(conflictReason, "controlled-equivalence", options, expectedLabel);
	if (!matches.length) return {};
	if (matches.length !== 1) return buildReviewResult("multiple-controlled-equivalence-candidates", "controlled-equivalence", matches, expectedLabel);
	return {
		status: "matched",
		tier: "controlled-equivalence",
		optionLabel: matches[0].label,
		candidates: rankTokenCandidates(options, expectedLabel),
		reason: "work-eligibility-controlled-equivalence",
	};
}

function isWorkEligibilityContext(context = {}) {
	const profileProperty = context.profileProperty || {};
	return profileProperty.path === "workAuthorization"
		&& profileProperty.source === "deterministic-work-eligibility"
		&& (context.fieldIntent === "work-authorization"
			|| context.fieldIntent === "work-eligibility"
			|| /\b(work eligibility|work authorization|right to work|authorized to work|eligible to work)\b/.test(normalizeOptionText(context.fieldLabel)));
}

function getWorkEligibilityDimensions(value) {
	const tokens = new Set(tokenizeOptionText(value));
	const text = normalizeOptionText(value);
	const negated = hasNegation(tokens) || /\b(not authorized|not eligible|not currently eligible|without work rights)\b/.test(text);
	const citizen = tokens.has("citizen");
	const permanentResident = tokens.has("permanent") && tokens.has("resident");
	const temporaryWorkRights = (tokens.has("work") && (tokens.has("visa") || tokens.has("permit") || tokens.has("rights")))
		|| tokens.has("temporary");
	return {
		citizen,
		permanentResident,
		temporaryWorkRights,
		sponsorshipRequired: getSponsorshipDimension(tokens),
		negated,
		yes: tokens.has("yes"),
		no: tokens.has("no"),
	};
}

function getSponsorshipDimension(tokens) {
	const mentionsSponsorship = tokens.has("sponsor") || tokens.has("sponsorship");
	if (!mentionsSponsorship) return null;
	if (tokens.has("no") || tokens.has("not") || tokens.has("without")) return false;
	return true;
}

function hasKnownWorkEligibilityCategory(dimensions) {
	return dimensions.citizen || dimensions.permanentResident || dimensions.temporaryWorkRights;
}

function getWorkEligibilityConflict(expected, candidate) {
	if (expected.negated !== candidate.negated && (expected.negated || candidate.negated)) return "negation-conflict";
	if (expected.yes && candidate.no || expected.no && candidate.yes) return "yes-no-conflict";
	if (expected.sponsorshipRequired === false && candidate.sponsorshipRequired === true) return "sponsorship-conflict";
	if (expected.sponsorshipRequired === true && candidate.sponsorshipRequired === false) return "sponsorship-conflict";
	if (expected.sponsorshipRequired === null && candidate.sponsorshipRequired !== null) return "sponsorship-unknown";
	if ((expected.citizen || expected.permanentResident) && candidate.temporaryWorkRights) return "conflicting-status";
	if (expected.temporaryWorkRights && (candidate.citizen || candidate.permanentResident)) return "conflicting-status";
	if (expected.permanentResident && candidate.citizen && !candidate.permanentResident) return "missing-permanent-resident";
	return "";
}

function getWorkEligibilityResidualTokens(expectedLabel, candidateLabel) {
	const expected = new Set(tokenizeOptionText(expectedLabel));
	const candidate = tokenizeOptionText(candidateLabel);
	const allowedDescriptorTokens = new Set(["visa"]);
	const requiredAnchorTokens = new Set(["or", "and"]);
	return candidate.filter((token) => {
		if (expected.has(token)) return false;
		if (allowedDescriptorTokens.has(token)) return false;
		if (requiredAnchorTokens.has(token)) return false;
		return true;
	});
}

function findUniqueCandidate(options, predicate) {
	const matches = options.filter(predicate);
	if (matches.length === 1) {
		return { status: "matched", optionLabel: matches[0].label };
	}
	if (matches.length > 1) return { status: "conflict", candidates: matches };
	return { status: "none" };
}

function rankTokenCandidates(options, expectedLabel) {
	const expectedTokens = tokenizeForSimilarity(expectedLabel);
	return options
		.map((option) => {
			const candidateTokens = tokenizeForSimilarity(`${option.label} ${option.value}`);
			return {
				label: option.label,
				score: weightedJaccard(expectedTokens, candidateTokens),
			};
		})
		.filter((candidate) => candidate.score > 0)
		.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
		.slice(0, MAX_REVIEW_CANDIDATES);
}

function tokenizeForSimilarity(value) {
	return new Set(tokenizeOptionText(value));
}

function weightedJaccard(left, right) {
	if (!left.size || !right.size) return 0;
	const union = new Set([...left, ...right]);
	let intersection = 0;
	for (const token of left) {
		if (right.has(token)) intersection += tokenWeight(token);
	}
	let total = 0;
	for (const token of union) total += tokenWeight(token);
	return Number((intersection / total).toFixed(3));
}

function tokenWeight(token) {
	if (["not", "no", "none", "without", "ineligible", "yes"].includes(token)) return 3;
	if (/^\d/.test(token)) return 2;
	if (["citizen", "permanent", "resident", "temporary", "work", "visa", "permit"].includes(token)) return 2;
	return 1;
}

function narrowBySelectionContext(options, selectionContext = {}) {
	const values = Object.values(selectionContext || {}).map(normalizeOptionText).filter(Boolean);
	if (!values.length) return options;
	return options.filter((option) => values.every((value) => containsDelimitedTokenSequence(option.canonicalLabel, value)));
}

function isCountryOrPhoneCountryContext(context = {}) {
	const fieldLabel = normalizeOptionText(context.fieldLabel);
	const selectionContext = context.selectionContext || {};
	return context.fieldIntent === "country"
		|| context.fieldIntent === "phone-country"
		|| selectionContext.kind === "country"
		|| selectionContext.kind === "phone-country"
		|| /\b(country|phone country|country code|dial code)\b/.test(fieldLabel);
}

function containsDelimitedTokenSequence(label, value) {
	const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(label);
}

function hasNegation(tokens) {
	return ["not", "no", "none", "without", "ineligible"].some((token) => tokens.has(token));
}

function buildReviewResult(reason, tier, options, expectedLabel) {
	return {
		status: "needs-review",
		tier,
		optionLabel: "",
		candidates: rankTokenCandidates(options, expectedLabel),
		reason,
	};
}

function buildUnmatchedResult(reason, options, expectedLabel) {
	return {
		status: "no-match",
		tier: "none",
		optionLabel: "",
		candidates: rankTokenCandidates(options, expectedLabel),
		reason,
	};
}

module.exports = {
	MAX_REVIEW_CANDIDATES,
	TOKEN_SIMILARITY_MIN_MARGIN,
	TOKEN_SIMILARITY_THRESHOLD,
	normalizeOptionText,
	resolveOption,
	tokenizeOptionText,
};
