const EXPECTED_COMPONENTS = [
	"text-input",
	"required-field",
	"label-association",
	"dropdown",
	"checkbox",
	"radio",
	"upload",
	"navigation-button",
	"validation-message",
];

const { buildApplicableComponents, buildApplicableCoverage } = require("./applicable-components");
const { buildPageProfile } = require("./page-profile");

const SUPPORTED_KINDS = new Set([
	"button",
	"checkbox",
	"editable",
	"file-upload",
	"interactive",
	"link",
	"radio",
	"selection",
	"text-input",
]);

function validateComponents(semanticPage) {
	const detectedComponents = buildDetectedComponents(semanticPage);
	const coverage = buildCoverageMetrics(detectedComponents);
	const pageProfile = buildPageProfile(semanticPage);
	const applicableComponents = buildApplicableComponents(pageProfile);
	const applicableCoverage = buildApplicableCoverage(detectedComponents, applicableComponents, coverage.coverageRatio);
	const missingComponents = buildMissingComponents(coverage);
	const unsupportedComponents = buildUnsupportedComponents(semanticPage);
	const potentialRisks = buildPotentialRisks(detectedComponents, missingComponents, unsupportedComponents);

	return {
		schemaVersion: 1,
		url: semanticPage.url,
		title: semanticPage.title,
		detectedComponents,
		missingComponents,
		unsupportedComponents,
		coverage: {
			...coverage,
			...applicableCoverage,
		},
		pageProfile,
		applicableComponents,
		confidence: calculateOverallConfidence(detectedComponents, unsupportedComponents, potentialRisks),
		potentialRisks,
	};
}

function buildDetectedComponents(semanticPage) {
	return (semanticPage.interactiveElements || []).map((element) => ({
		id: element.id,
		kind: element.kind,
		role: element.role || "",
		label: {
			text: element.label && element.label.text || "",
			source: element.label && element.label.source || "",
			confidence: element.label && element.label.confidence || 0,
		},
		required: Boolean(element.required),
		disabled: Boolean(element.disabled),
		componentTypes: classifyComponentTypes(element),
		confidence: calculateComponentConfidence(element),
		validation: {
			valid: element.validation ? element.validation.valid !== false : true,
			message: element.validation && element.validation.message || "",
			detected: Boolean(element.validation && element.validation.valid === false && element.validation.message),
		},
		risks: buildComponentRisks(element),
	}));
}

function classifyComponentTypes(element) {
	const types = [];

	if (element.kind === "text-input" || element.kind === "editable") types.push("text-input");
	if (element.required) types.push("required-field");
	if (element.label && element.label.text) types.push("label-association");
	if (element.kind === "selection") types.push("dropdown");
	if (element.kind === "checkbox") types.push("checkbox");
	if (element.kind === "radio") types.push("radio");
	if (element.kind === "file-upload") types.push("upload");
	if (isApplicationEntryLink(element)) types.push("application-entry-link");
	if (isNavigationButton(element)) types.push("navigation-button");
	if (element.validation && element.validation.valid === false && element.validation.message) types.push("validation-message");

	return types;
}

function isNavigationButton(element) {
	if (!["button", "link"].includes(element.kind)) return false;
	const label = element.label && element.label.text || "";
	return /\b(next|continue|proceed|save and continue|back|previous)\b/i.test(label);
}

function isApplicationEntryLink(element) {
	if (!["button", "link"].includes(element.kind)) return false;
	const label = element.label && element.label.text || "";
	return /^\s*(apply now|start application|begin application)\s*$/i.test(label);
}

function calculateComponentConfidence(element) {
	let score = 60;

	if (element.label && element.label.text) score += Math.round((element.label.confidence || 0) * 25);
	if (element.role) score += 5;
	if (element.required) score += 3;
	if (element.kind === "selection" && element.options && element.options.length) score += 5;
	if (SUPPORTED_KINDS.has(element.kind)) score += 2;

	return Math.min(score, 100);
}

function buildComponentRisks(element) {
	const risks = [];

	if (!element.label || !element.label.text) {
		risks.push({
			type: "missing-label",
			severity: "high",
			message: "Component has no detected accessible or nearby label.",
		});
	}

	if (!SUPPORTED_KINDS.has(element.kind)) {
		risks.push({
			type: "unsupported-kind",
			severity: "high",
			message: `Component kind "${element.kind}" is not currently supported.`,
		});
	}

	if (element.kind === "selection" && (!element.options || !element.options.length)) {
		risks.push({
			type: "empty-dropdown-options",
			severity: "medium",
			message: "Dropdown was detected but no options were captured.",
		});
	}

	if (element.required && (!element.label || !element.label.text)) {
		risks.push({
			type: "required-field-without-label",
			severity: "high",
			message: "Required field cannot be safely matched without a label.",
		});
	}

	return risks;
}

function buildCoverageMetrics(detectedComponents) {
	const counts = Object.fromEntries(EXPECTED_COMPONENTS.map((component) => [component, 0]));

	for (const component of detectedComponents) {
		for (const type of component.componentTypes) {
			if (Object.prototype.hasOwnProperty.call(counts, type)) {
				counts[type] += 1;
			}
		}
	}

	const presentComponentTypes = Object.entries(counts)
		.filter(([, count]) => count > 0)
		.map(([type]) => type);
	const legacyCoverageRatio = EXPECTED_COMPONENTS.length
		? round(presentComponentTypes.length / EXPECTED_COMPONENTS.length)
		: 0;

	return {
		totalDetectedComponents: detectedComponents.length,
		counts,
		presentComponentTypes,
		legacyCoverageRatio: legacyCoverageRatio,
		coverageRatio: legacyCoverageRatio,
	};
}

function buildMissingComponents(coverage) {
	return EXPECTED_COMPONENTS
		.filter((component) => !coverage.presentComponentTypes.includes(component))
		.map((component) => ({
			type: component,
			message: `No ${component} component was detected on this page.`,
		}));
}

function buildUnsupportedComponents(semanticPage) {
	return (semanticPage.interactiveElements || [])
		.filter((element) => !SUPPORTED_KINDS.has(element.kind))
		.map((element) => ({
			id: element.id,
			kind: element.kind,
			label: {
				text: element.label && element.label.text || "",
				source: element.label && element.label.source || "",
			},
			message: `Unsupported interactive component kind "${element.kind}".`,
		}));
}

function buildPotentialRisks(detectedComponents, missingComponents, unsupportedComponents) {
	const risks = detectedComponents.flatMap((component) =>
		component.risks.map((risk) => ({
			...risk,
			componentId: component.id,
			label: component.label,
		})),
	);

	for (const component of missingComponents) {
		risks.push({
			type: `missing-${component.type}`,
			severity: "info",
			message: component.message,
		});
	}

	for (const component of unsupportedComponents) {
		risks.push({
			type: "unsupported-component",
			severity: "high",
			componentId: component.id,
			label: component.label,
			message: component.message,
		});
	}

	return risks;
}

function calculateOverallConfidence(detectedComponents, unsupportedComponents, potentialRisks) {
	if (!detectedComponents.length) return 0;

	const averageComponentConfidence = detectedComponents.reduce((sum, component) => sum + component.confidence, 0) / detectedComponents.length;
	const highRiskPenalty = potentialRisks.filter((risk) => risk.severity === "high").length * 8;
	const unsupportedPenalty = unsupportedComponents.length * 12;

	return Math.max(0, Math.round(averageComponentConfidence - highRiskPenalty - unsupportedPenalty));
}

function round(value) {
	return Math.round(value * 100) / 100;
}

module.exports = {
	validateComponents,
};
