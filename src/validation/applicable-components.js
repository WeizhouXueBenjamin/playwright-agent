const APPLICABLE_COMPONENTS_SCHEMA_VERSION = 1;

const COMPONENTS_BY_PROFILE = {
	"application-entry": {
		required: ["application-entry-link", "label-association"],
		optional: ["navigation-button"],
	},
	"application-form": {
		required: ["text-input", "required-field", "label-association"],
		optional: ["dropdown", "checkbox", "radio", "upload", "navigation-button", "validation-message"],
	},
	authentication: {
		required: ["text-input", "label-association"],
		optional: ["navigation-button", "validation-message"],
	},
	"intermediate-navigation": {
		required: ["navigation-button", "label-association"],
		optional: ["validation-message"],
	},
	"content-page": {
		required: ["label-association"],
		optional: ["application-entry-link", "navigation-button"],
	},
	unknown: {
		required: ["label-association"],
		optional: ["text-input", "navigation-button", "validation-message"],
	},
};

function buildApplicableComponents(pageProfile = {}) {
	const definition = COMPONENTS_BY_PROFILE[pageProfile.type] || COMPONENTS_BY_PROFILE.unknown;
	const components = [
		...definition.required.map((type) => component(type, true, pageProfile.type)),
		...definition.optional.map((type) => component(type, false, pageProfile.type)),
	];

	return {
		schemaVersion: APPLICABLE_COMPONENTS_SCHEMA_VERSION,
		pageProfileType: pageProfile.type || "unknown",
		required: definition.required,
		optional: definition.optional,
		components,
	};
}

function buildApplicableCoverage(detectedComponents, applicableComponents, legacyCoverageRatio) {
	const counts = countComponentTypes(detectedComponents);
	const required = applicableComponents.required || [];
	const optional = applicableComponents.optional || [];
	const presentRequired = required.filter((type) => (counts[type] || 0) > 0);
	const presentOptional = optional.filter((type) => (counts[type] || 0) > 0);

	return {
		legacyCoverageRatio,
		applicableCoverageRatio: required.length ? round(presentRequired.length / required.length) : 1,
		requiredApplicableCount: required.length,
		presentRequiredApplicableCount: presentRequired.length,
		optionalApplicableCount: optional.length,
		presentOptionalApplicableCount: presentOptional.length,
		missingRequiredApplicableComponents: required
			.filter((type) => !presentRequired.includes(type))
			.map((type) => ({
				type,
				message: `No applicable ${type} component was detected for this page profile.`,
			})),
		presentApplicableComponentTypes: [...presentRequired, ...presentOptional],
	};
}

function countComponentTypes(detectedComponents) {
	const counts = {};
	for (const component of detectedComponents || []) {
		for (const type of component.componentTypes || []) {
			counts[type] = (counts[type] || 0) + 1;
		}
	}
	return counts;
}

function component(type, required, pageProfileType) {
	return {
		type,
		required,
		pageProfileType,
	};
}

function round(value) {
	return Math.round(value * 100) / 100;
}

module.exports = {
	buildApplicableComponents,
	buildApplicableCoverage,
};
