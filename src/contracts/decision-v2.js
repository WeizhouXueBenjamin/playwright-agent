const DECISION_V2_SCHEMA_VERSION = 2;
const DECISION_TYPES = new Set(["act", "request-review", "no-action", "recovery-proposal"]);
const FORBIDDEN_KEYS = new Set([
	"selector",
	"selectors",
	"locator",
	"locatorStrategy",
	"playwright",
	"javascript",
	"js",
	"code",
	"command",
	"evaluate",
]);

function assertDecisionV2Contract(decision) {
	if (!decision || typeof decision !== "object") throw new Error("Decision v2 must be an object.");
	rejectExecutableFields(decision);
	if (decision.schemaVersion !== DECISION_V2_SCHEMA_VERSION) {
		throw new Error(`Unsupported Decision v2 schemaVersion "${decision.schemaVersion}".`);
	}
	if (!DECISION_TYPES.has(decision.type)) throw new Error(`Unsupported Decision v2 type "${decision.type}".`);
	if (typeof decision.decisionId !== "string" || !decision.decisionId) throw new Error("Decision v2 requires decisionId.");
	if (typeof decision.observationId !== "string" || !decision.observationId) throw new Error("Decision v2 requires observationId.");
	if (typeof decision.observationFingerprint !== "string" || !decision.observationFingerprint) {
		throw new Error("Decision v2 requires observationFingerprint.");
	}
	if (typeof decision.goal !== "string") throw new Error("Decision v2 goal must be a string.");
	if (decision.type === "act") assertActDecision(decision);
}

function assertActDecision(decision) {
	for (const key of [
		"targetElementId",
		"interpretedPageGoal",
		"interpretedFieldIntent",
		"selectedProfileFactId",
		"proposedAbstractCapability",
		"expectedPostcondition",
	]) {
		if (typeof decision[key] !== "string" || !decision[key]) throw new Error(`Decision v2 act requires ${key}.`);
	}
	if (!Array.isArray(decision.evidenceReferences)) throw new Error("Decision v2 act requires evidenceReferences array.");
	if (!decision.selectedProfileFact || typeof decision.selectedProfileFact !== "object") {
		throw new Error("Decision v2 act requires selectedProfileFact.");
	}
	if (!Array.isArray(decision.alternativesConsidered)) throw new Error("Decision v2 act requires alternativesConsidered array.");
	if (!decision.reviewRequirement || typeof decision.reviewRequirement !== "object") {
		throw new Error("Decision v2 act requires reviewRequirement.");
	}
	if (!Object.prototype.hasOwnProperty.call(decision, "uncertainty")) throw new Error("Decision v2 act requires uncertainty.");
	if (!Object.prototype.hasOwnProperty.call(decision, "proposedValue")) throw new Error("Decision v2 act requires proposedValue.");
}

function rejectExecutableFields(value, path = "") {
	if (!value || typeof value !== "object") return;
	if (Array.isArray(value)) {
		value.forEach((item, index) => rejectExecutableFields(item, `${path}[${index}]`));
		return;
	}

	for (const [key, child] of Object.entries(value)) {
		if (FORBIDDEN_KEYS.has(key)) throw new Error(`Decision v2 must not include executable field "${key}".`);
		rejectExecutableFields(child, path ? `${path}.${key}` : key);
	}
}

function buildBaseDecision(input = {}) {
	return {
		schemaVersion: DECISION_V2_SCHEMA_VERSION,
		decisionId: input.decisionId || `decision-${Date.now()}-${Math.random().toString(16).slice(2)}`,
		observationId: input.observationId,
		observationFingerprint: input.observationFingerprint,
		goal: input.goal || "",
		semanticOwner: input.semanticOwner || "deterministic-semantic-rule",
	};
}

module.exports = {
	DECISION_V2_SCHEMA_VERSION,
	assertDecisionV2Contract,
	buildBaseDecision,
};
