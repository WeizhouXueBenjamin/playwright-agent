const { resolveOption } = require("../actions/option-resolver");

function resolveWorkEligibilityProfileProperty(field = {}, profile = {}) {
	const fieldText = getPrimaryFieldText(field);
	if (!/\b(work eligibility|work authorization|right to work|authorized to work|eligible to work)\b/.test(fieldText)) return null;

	const rawValue = profile.workAuthorization;
	if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") return null;

	const value = resolveWorkEligibilityValue(rawValue, field, {
		requiresSponsorship: getRequiresSponsorship(profile),
	});
	if (!value) return null;

	return {
		path: "workAuthorization",
		value,
		valueType: typeof value,
		valuePresent: true,
		source: "deterministic-work-eligibility",
		rawProfileValue: rawValue,
		requiresSponsorship: getRequiresSponsorship(profile),
	};
}

function resolveWorkEligibilityValue(rawValue, field = {}, context = {}) {
	const normalized = normalize(rawValue);
	const optionMatch = matchAvailableOption(normalized, field.options || [], context);
	if (optionMatch) return optionMatch;

	if (isBooleanQuestion(field)) {
		if (rawValue === true || /\b(citizen|permanent resident|resident visa|work visa|open work visa|work permit|authorized|eligible|right to work)\b/.test(normalized)) {
			return "Yes";
		}
		if (rawValue === false || /\b(no|not authorized|not eligible)\b/.test(normalized)) return "No";
		return "";
	}

	if (/\b(citizen|permanent resident|resident visa|permanent resident visa)\b/.test(normalized)) {
		const controlledOption = matchAvailableOption(normalize("Citizen or Permanent Resident Visa"), field.options || [], context);
		if (controlledOption) return controlledOption;
		return "Citizen or Permanent Resident Visa";
	}
	if (/\b(open work visa|work visa|work permit)\b/.test(normalized)) {
		const controlledOption = matchAvailableOption(normalize("Work Visa"), field.options || [], context);
		if (controlledOption) return controlledOption;
		return "Work Visa";
	}

	return String(rawValue).trim();
}

function matchAvailableOption(normalizedValue, options, context = {}) {
	const result = resolveOption(options, normalizedValue, {
		fieldIntent: "work-authorization",
		fieldLabel: "Work Eligibility",
		profileProperty: {
			path: "workAuthorization",
			source: "deterministic-work-eligibility",
		},
		requiresSponsorship: context.requiresSponsorship,
	});
	return result.status === "matched" ? result.optionLabel : "";
}

function getRequiresSponsorship(profile) {
	if (profile.requiresSponsorship === true) return true;
	if (profile.requiresSponsorship === false) return false;
	return null;
}

function isBooleanQuestion(field) {
	const text = getPrimaryFieldText(field);
	const optionTexts = (field.options || []).map((option) => normalize(option.label || option.value)).filter(Boolean);
	if (optionTexts.length) return optionTexts.every((option) => ["yes", "no", "true", "false", "y", "n"].includes(option));
	return /\b(legally authorized|authorized to work|eligible to work|right to work)\b/.test(text);
}

function getPrimaryFieldText(field) {
	return [
		field.label && field.label.text,
		...(field.labelCandidates || [])
			.filter((candidate) => ["label", "aria-label", "aria-labelledby", "placeholder", "fieldset-legend"].includes(candidate.source))
			.map((candidate) => candidate.text),
		field.placeholder,
	].map(normalize).join(" ");
}

function getFieldText(field) {
	return [
		field.label && field.label.text,
		...(field.labelCandidates || []).map((candidate) => candidate.text),
		field.placeholder,
		field.evidence && field.evidence.visibleText,
	].map(normalize).join(" ");
}

function normalize(value) {
	return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

module.exports = {
	resolveWorkEligibilityProfileProperty,
	resolveWorkEligibilityValue,
};
