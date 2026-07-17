const { listProfileProperties } = require("../profile/profile-properties");
const { scoreTextMatch } = require("./text-similarity");

const MATCHABLE_KINDS = new Set(["text-input", "checkbox", "radio", "selection", "editable", "interactive"]);

function matchFieldsToProfile(semanticPage, profile, options = {}) {
	const threshold = options.threshold || 45;
	const profileProperties = listProfileProperties(profile);

	return getMatchableFields(semanticPage).map((field) => {
		const candidates = rankProfileCandidates(field, profileProperties);
		const bestCandidate = candidates[0];

		if (!bestCandidate || bestCandidate.confidenceScore < threshold) {
			return {
				field: describeField(field),
				matchedProfileProperty: null,
				confidenceScore: 0,
				reasoning: "No profile property met the confidence threshold.",
				candidates: candidates.slice(0, 3),
			};
		}

		return {
			field: describeField(field),
			matchedProfileProperty: {
				path: bestCandidate.path,
				valueType: bestCandidate.valueType,
				valuePresent: bestCandidate.valuePresent,
			},
			confidenceScore: bestCandidate.confidenceScore,
			reasoning: bestCandidate.reasoning,
			candidates: candidates.slice(0, 3),
		};
	});
}

function getMatchableFields(semanticPage) {
	return (semanticPage.interactiveElements || []).filter((element) => {
		if (element.disabled || element.readonly) return false;
		if (!MATCHABLE_KINDS.has(element.kind)) return false;
		return element.kind !== "button" && element.kind !== "link";
	});
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
		label: field.label,
		required: field.required,
		inputType: field.inputType,
	};
}

module.exports = {
	matchFieldsToProfile,
};
