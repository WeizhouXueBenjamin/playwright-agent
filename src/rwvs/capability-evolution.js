const fs = require("node:fs/promises");
const path = require("node:path");

const { writeJsonArtifact, writeTextArtifact } = require("../logging/artifact-store");

const CAPABILITY_HISTORY_SCHEMA_VERSION = 1;

const CAPABILITY_TAXONOMY = [
	"Policy Navigation",
	"Runtime State Planning",
	"Field Identification",
	"Semantic Matching",
	"Verification",
	"Recovery",
	"Page Profile",
	"Applicable Components",
	"Safety / Policy",
];

async function updateCapabilityEvolutionArtifacts(baseDir, report, options = {}) {
	const historyPath = path.join(baseDir, "capability-history.json");
	const markdownPath = path.join(baseDir, "capability-evolution-log.md");
	const previous = await readHistory(historyPath);
	const next = mergeHistory(previous, buildCapabilitySummary(report, options));

	await fs.mkdir(baseDir, { recursive: true });
	await writeJsonArtifact(baseDir, "capability-history.json", next);
	await writeTextArtifact(baseDir, "capability-evolution-log.md", buildCapabilityEvolutionMarkdown(next));

	return {
		historyPath,
		markdownPath,
		history: next,
	};
}

function buildCapabilitySummary(report, options = {}) {
	const records = buildCapabilityRecords(report, options);

	return {
		schemaVersion: CAPABILITY_HISTORY_SCHEMA_VERSION,
		mode: "capability-evolution-history",
		taxonomy: CAPABILITY_TAXONOMY,
		records,
	};
}

function buildCapabilityRecords(report, options = {}) {
	return [
		...detectPolicyNavigationRecords(report, options),
		...detectRuntimeStatePlanningRecords(report, options),
		...detectBacklogRecords(report, options),
	];
}

function detectPolicyNavigationRecords(report, options) {
	const metricsV2 = report.metricsV2 || {};
	const profile = metricsV2.pageProfile || {};
	const executionTimeline = getExecutionTimeline(options);
	const clickedEntry = executionTimeline.find((entry) => {
		const action = entry.action || {};
		const field = action.field || {};
		return action.type === "click" && /^\s*apply now\s*$/i.test(field.text || "");
	});

	if (profile.type !== "application-entry" && !clickedEntry) return [];

	return [record(report, {
		capability: "Policy Navigation",
		capabilityGap: "Safe Application Entry",
		evidence: [
			`pageProfile=${profile.type || "unknown"}`,
			`applicableCoverage=${formatRatio(metricsV2.coverage && metricsV2.coverage.applicableCoverageRatio)}`,
			clickedEntry ? "verified application-entry click" : "application-entry profile observed",
		],
		genericImprovement: "Recognize exact application-entry links as safe navigation while preserving final submission blocking.",
		status: clickedEntry ? "Validated" : "Proposed",
		affectedLayers: ["Decision", "Page", "Safety / Policy"],
	})];
}

function detectRuntimeStatePlanningRecords(report, options) {
	const metricsV2 = report.metricsV2 || {};
	const task = metricsV2.task || {};
	const decision = metricsV2.decision || {};
	const executionTimeline = getExecutionTimeline(options);
	const repeatedLabels = findRepeatedActionLabels(executionTimeline);
	const completedFieldCount = Number(task.completedFieldCount || 0);
	const actionDecisionCount = Number(decision.actionDecisionCount || 0);

	if (!completedFieldCount && !repeatedLabels.length) return [];

	return [record(report, {
		capability: "Runtime State Planning",
		capabilityGap: "Skip Verified Fields",
		evidence: [
			`completedFieldCount=${completedFieldCount}`,
			`actionDecisionCount=${actionDecisionCount}`,
			`repeatedActionLabels=${repeatedLabels.join(", ") || "none"}`,
			`taskStatus=${task.status || "unknown"}`,
		],
		genericImprovement: "Use runtimeState.completedFields to skip already verified field/profile pairs during planning.",
		status: repeatedLabels.length ? "Proposed" : "Validated",
		affectedLayers: ["Decision", "Runtime State", "Task"],
	})];
}

function detectBacklogRecords(report) {
	const items = report.backlog && report.backlog.items || [];
	return items.map((item) => {
		const capability = mapBacklogAreaToCapability(item.area, item.issue);
		return record(report, {
			capability,
			capabilityGap: item.issue,
			evidence: [
				`backlogPriority=${item.priority}`,
				`area=${item.area}`,
				`estimatedImpact=${item.estimatedImpact}`,
			],
			genericImprovement: item.suggestedFix,
			status: item.status || "Open",
			affectedLayers: mapCapabilityToLayers(capability),
		});
	});
}

function record(report, input) {
	const metricsV2 = report.metricsV2 || {};
	const pageProfile = metricsV2.pageProfile || {};
	const task = metricsV2.task || {};

	return {
		benchmarkId: report.website || report.runId,
		runId: report.runId,
		platform: inferPlatform(report),
		result: report.result,
		pageProfile: pageProfile.type || "unknown",
		taskOutcome: task.status || "unknown",
		capability: input.capability,
		capabilityGap: input.capabilityGap,
		evidence: input.evidence,
		genericImprovement: input.genericImprovement,
		status: input.status,
		affectedLayers: input.affectedLayers,
	};
}

function mergeHistory(previous, current) {
	const records = [...(previous.records || [])];

	for (const record of current.records) {
		const key = recordKey(record);
		const existingIndex = records.findIndex((item) => recordKey(item) === key);
		if (existingIndex === -1) {
			records.push(record);
		} else {
			records[existingIndex] = record;
		}
	}

	return {
		schemaVersion: CAPABILITY_HISTORY_SCHEMA_VERSION,
		mode: "capability-evolution-history",
		taxonomy: CAPABILITY_TAXONOMY,
		records,
	};
}

function buildCapabilityEvolutionMarkdown(history) {
	return [
		"# Capability Evolution Log",
		"",
		"## Taxonomy",
		"",
		...history.taxonomy.map((item) => `- ${item}`),
		"",
		"## Records",
		"",
		table([
			"Benchmark",
			"Platform",
			"Result",
			"Page Profile",
			"Task Outcome",
			"Capability",
			"Gap",
			"Status",
			"Affected Layers",
			"Generic Improvement",
			"Evidence",
		], history.records.map((item) => [
			item.benchmarkId,
			item.platform,
			item.result,
			item.pageProfile,
			item.taskOutcome,
			item.capability,
			item.capabilityGap,
			item.status,
			item.affectedLayers.join(", "),
			item.genericImprovement,
			item.evidence.join("; "),
		])),
		"",
	].join("\n");
}

async function readHistory(historyPath) {
	try {
		const content = await fs.readFile(historyPath, "utf8");
		const parsed = JSON.parse(content);
		return parsed && parsed.schemaVersion === CAPABILITY_HISTORY_SCHEMA_VERSION
			? parsed
			: emptyHistory();
	} catch {
		return emptyHistory();
	}
}

function emptyHistory() {
	return {
		schemaVersion: CAPABILITY_HISTORY_SCHEMA_VERSION,
		mode: "capability-evolution-history",
		taxonomy: CAPABILITY_TAXONOMY,
		records: [],
	};
}

function getExecutionTimeline(options) {
	return options.executionReport && options.executionReport.executionTimeline || [];
}

function findRepeatedActionLabels(executionTimeline) {
	const counts = {};
	for (const entry of executionTimeline || []) {
		const action = entry.action || {};
		const field = action.field || {};
		const label = field.text || "";
		if (!label || action.verificationOk !== true) continue;
		counts[label] = (counts[label] || 0) + 1;
	}
	return Object.entries(counts)
		.filter(([, count]) => count > 1)
		.map(([label]) => label);
}

function mapBacklogAreaToCapability(area, issue) {
	const text = `${area || ""} ${issue || ""}`.toLowerCase();
	if (text.includes("runtime")) return "Runtime State Planning";
	if (text.includes("policy") || text.includes("irreversible")) return "Safety / Policy";
	if (text.includes("verification")) return "Verification";
	if (text.includes("recovery")) return "Recovery";
	if (text.includes("profile")) return "Page Profile";
	if (text.includes("component") || text.includes("dropdown") || text.includes("radio") || text.includes("label")) return "Field Identification";
	if (text.includes("reasoning") || text.includes("matching")) return "Semantic Matching";
	if (text.includes("navigation")) return "Policy Navigation";
	return "Field Identification";
}

function mapCapabilityToLayers(capability) {
	const layers = {
		"Policy Navigation": ["Decision", "Safety / Policy"],
		"Runtime State Planning": ["Decision", "Runtime State", "Task"],
		"Field Identification": ["Observation", "Page"],
		"Semantic Matching": ["Decision", "Task"],
		Verification: ["Decision", "Task"],
		Recovery: ["Recovery", "Task"],
		"Page Profile": ["Page"],
		"Applicable Components": ["Page", "Benchmark"],
		"Safety / Policy": ["Decision", "Safety / Policy"],
	};
	return layers[capability] || ["Benchmark"];
}

function inferPlatform(report) {
	const website = report.website || "";
	if (website.includes("greenhouse")) return "Greenhouse";
	if (website.includes("qjumpers")) return "QJumpers";
	return website || "unknown";
}

function recordKey(record) {
	return `${record.runId}:${record.capability}:${record.capabilityGap}`;
}

function formatRatio(value) {
	if (value === undefined || value === null) return "n/a";
	return `${Math.round(Number(value || 0) * 100)}%`;
}

function table(headers, rows) {
	return [
		`| ${headers.join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
	].join("\n");
}

function escapeCell(value) {
	return String(value === undefined || value === null ? "" : value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

module.exports = {
	CAPABILITY_TAXONOMY,
	buildCapabilityEvolutionMarkdown,
	buildCapabilitySummary,
	updateCapabilityEvolutionArtifacts,
};
