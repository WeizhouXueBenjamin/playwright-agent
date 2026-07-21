const crypto = require("node:crypto");

const OBSERVATION_V2_SCHEMA_VERSION = 2;
const HISTORY_LIMIT = 5;

function buildObservationV2Contract(input = {}) {
	const observation = input.observation || {};
	const semanticPage = observation.semanticPage || {};
	const observedElements = (semanticPage.interactiveElements || []).map(toObservedElement);
	const v2 = {
		schemaVersion: OBSERVATION_V2_SCHEMA_VERSION,
		observationId: input.observationId || buildObservationId(observation.fingerprint, semanticPage.url),
		observationFingerprint: observation.fingerprint || "",
		url: semanticPage.url || "",
		title: semanticPage.title || "",
		taskGoal: input.goal || "",
		pageSummary: semanticPage.summary || {},
		semanticSections: buildSemanticSections(semanticPage),
		headings: semanticPage.headings || [],
		observedElements,
		supportedAbstractCapabilities: getSupportedCapabilities(observedElements),
		runtimeStateSummary: summarizeRuntimeState(input.runtimeState || {}),
		recentHistory: (input.history || []).slice(-HISTORY_LIMIT).map(summarizeHistoryEntry),
		currentBlockers: input.currentBlockers || [],
		policySummary: Object.freeze({ ...(input.policySummary || {}) }),
		safetySummary: Object.freeze({ ...(input.safetySummary || {}) }),
		candidateSignals: input.candidateSignals || [],
	};

	assertObservationV2Contract(v2);
	return v2;
}

function assertObservationV2Contract(observation) {
	if (!observation || typeof observation !== "object") throw new Error("Observation v2 must be an object.");
	if (observation.schemaVersion !== OBSERVATION_V2_SCHEMA_VERSION) {
		throw new Error(`Unsupported Observation v2 schemaVersion "${observation.schemaVersion}".`);
	}
	for (const key of ["observationId", "observationFingerprint", "url", "title", "taskGoal"]) {
		if (typeof observation[key] !== "string") throw new Error(`Observation v2 ${key} must be a string.`);
	}
	if (!Array.isArray(observation.observedElements)) throw new Error("Observation v2 observedElements must be an array.");
	for (const element of observation.observedElements) {
		if (typeof element.elementId !== "string" || !element.elementId) {
			throw new Error("Observation v2 element requires opaque elementId.");
		}
		if (JSON.stringify(element).includes("selector")) {
			throw new Error("Observation v2 must not expose selectors.");
		}
	}
}

function toObservedElement(element = {}) {
	return {
		elementId: element.id,
		kind: element.kind || "",
		role: element.role || "",
		tagName: element.tagName || "",
		inputType: element.inputType || "",
		labelCandidates: (element.labelCandidates || []).map((candidate) => ({
			text: candidate.text || "",
			source: candidate.source || "",
			confidence: candidate.confidence,
		})),
		label: {
			text: element.label && element.label.text || "",
			source: element.label && element.label.source || "",
		},
		placeholder: element.placeholder || "",
		nearbyText: element.evidence && element.evidence.visibleText || "",
		controlType: element.kind || "",
		rawStructuralAttributes: {
			required: Boolean(element.required),
			disabled: Boolean(element.disabled),
			readonly: Boolean(element.readonly),
			autocomplete: element.autocomplete || "",
			ariaRequired: element.ariaRequired || "",
		},
		availableOptions: (element.options || []).map((option) => ({
			label: option.label || "",
			valuePresent: Boolean(option.valuePresent),
			disabled: Boolean(option.disabled),
		})),
		structuralConstraints: element.constraints || {},
		currentState: sanitizeState(element.state || {}),
		supportedCapabilities: getElementCapabilities(element),
		candidateSignals: element.fieldAnswerSafety ? [element.fieldAnswerSafety] : [],
	};
}

function buildSemanticSections(semanticPage = {}) {
	if (Array.isArray(semanticPage.sections)) return semanticPage.sections;
	return (semanticPage.forms || []).map((form) => ({
		sectionId: form.id || "",
		heading: form.label || "",
		controlIds: form.controls || [],
	}));
}

function getElementCapabilities(element = {}) {
	if (element.kind === "text-input" || element.kind === "editable") return ["fill-text"];
	if (element.kind === "checkbox") return ["set-checkbox"];
	if (element.kind === "radio" || element.kind === "selection") return ["select-option"];
	if (element.kind === "file-upload") return ["upload-file"];
	if (element.kind === "button" || element.kind === "link") return ["click"];
	return [];
}

function getSupportedCapabilities(elements) {
	return [...new Set(elements.flatMap((element) => element.supportedCapabilities || []))];
}

function summarizeRuntimeState(state = {}) {
	return {
		currentExecutionStatus: state.currentExecutionStatus || "",
		currentBrowserState: state.currentBrowserState || "",
		completedFieldCount: Array.isArray(state.completedFields) ? state.completedFields.length : 0,
		remainingRequiredFieldCount: Array.isArray(state.remainingRequiredFields) ? state.remainingRequiredFields.length : 0,
		reviewAnswerCount: Array.isArray(state.reviewAnswers) ? state.reviewAnswers.length : 0,
	};
}

function summarizeHistoryEntry(entry = {}) {
	return {
		cycle: entry.cycle,
		phase: entry.phase,
		decisionType: entry.decision && entry.decision.type || "",
		action: entry.actionResult && entry.actionResult.step && entry.actionResult.step.action || "",
		verificationOk: entry.actionResult && entry.actionResult.verification
			? Boolean(entry.actionResult.verification.ok)
			: undefined,
	};
}

function sanitizeState(state = {}) {
	const clean = {};
	if (Object.prototype.hasOwnProperty.call(state, "value")) clean.value = state.value;
	if (Object.prototype.hasOwnProperty.call(state, "checked")) clean.checked = state.checked;
	if (Object.prototype.hasOwnProperty.call(state, "selectedLabel")) clean.selectedLabel = state.selectedLabel;
	if (Array.isArray(state.files)) clean.files = state.files.map((file) => ({ name: file.name, size: file.size }));
	return clean;
}

function buildObservationId(fingerprint, url) {
	return `obs-${hash(`${url || ""}:${fingerprint || ""}`).slice(0, 16)}`;
}

function hash(value) {
	return crypto.createHash("sha256").update(String(value)).digest("hex");
}

module.exports = {
	OBSERVATION_V2_SCHEMA_VERSION,
	assertObservationV2Contract,
	buildObservationV2Contract,
};
