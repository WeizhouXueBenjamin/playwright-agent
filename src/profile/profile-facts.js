const crypto = require("node:crypto");

const { listProfileProperties } = require("./profile-properties");
const { scoreTextMatch } = require("../reasoning/text-similarity");
const { collectFieldEvidence } = require("../reasoning/field-answer-safety");

function retrieveRelevantProfileFacts(input = {}) {
	const profile = input.profile || {};
	const field = input.field || null;
	const limit = input.limit || 8;
	const facts = listProfileProperties(profile)
		.map((property) => toProfileFact(property, scoreProperty(field, property)))
		.sort((left, right) => right.relevanceScore - left.relevanceScore)
		.slice(0, limit);

	if (!facts.length || facts.every((fact) => fact.relevanceScore <= 0)) {
		return {
			facts,
			noSuitableFactAvailable: true,
		};
	}

	return {
		facts,
		noSuitableFactAvailable: false,
	};
}

function toProfileFact(property, relevanceScore = 0) {
	return {
		factId: buildFactId(property.path),
		path: property.path,
		value: property.value,
		valueType: property.valueType,
		provenance: property.source || "profile",
		explicitness: property.derived ? "derived" : "explicit",
		scope: property.scope || "profile",
		freshness: property.freshness || "",
		valuePresent: Boolean(property.valuePresent),
		relevanceScore,
	};
}

function factFromProfileProperty(profileProperty = {}) {
	return {
		factId: buildFactId(profileProperty.path || "runtime-action-value"),
		path: profileProperty.path || "",
		value: Object.prototype.hasOwnProperty.call(profileProperty, "value")
			? profileProperty.value
			: profileProperty.valuePreview,
		valueType: profileProperty.valueType || typeof profileProperty.value,
		provenance: profileProperty.source || "profile",
		explicitness: profileProperty.source === "explicit-user-review" ? "explicit" : "explicit",
		scope: profileProperty.scope || "profile",
		freshness: profileProperty.freshness || "",
		valuePresent: profileProperty.valuePresent !== false,
		reviewAnswer: profileProperty.reviewAnswer,
	};
}

function buildFactId(path) {
	return `fact-${hash(path || "")}`;
}

function scoreProperty(field, property) {
	if (!field) return 0;
	const evidence = collectFieldEvidence(field).map((item) => item.value);
	let best = 0;
	for (const phrase of evidence) {
		for (const profilePhrase of property.searchPhrases || []) {
			best = Math.max(best, Math.round(scoreTextMatch(phrase, profilePhrase) * 100));
		}
	}
	return best;
}

function hash(value) {
	return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

module.exports = {
	buildFactId,
	factFromProfileProperty,
	retrieveRelevantProfileFacts,
};
