const PROPOSAL_SCHEMA_VERSION = 1;

function buildImprovementProposals(report, options = {}) {
	const candidates = [
		...buildOutcomeProposalCandidates(report),
		...buildBacklogProposalCandidates(report),
		...buildEfficiencyProposalCandidates(report),
	];
	const merged = mergeCandidates(candidates);
	const ranked = merged
		.map((proposal) => ({
			...proposal,
			priorityScore: scoreProposal(proposal, options.capabilityHistory),
		}))
		.sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title))
		.map(({ priorityScore, ...proposal }) => proposal);

	return {
		schemaVersion: PROPOSAL_SCHEMA_VERSION,
		mode: "rwvs-improvement-proposals",
		runId: report.runId,
		items: ranked,
	};
}

function buildOutcomeProposalCandidates(report) {
	const outcome = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.outcome || {};
	if (!outcome.blockerCapability || outcome.status === "completed") return [];
	if (outcome.blockerCapability === "Runtime State Planning" && isVerifiedFieldSkipValidated(report)) return [];

	return [proposalFromCapability(report, {
		capability: outcome.blockerCapability,
		title: titleForCapability(outcome.blockerCapability),
		evidence: [
			`taskOutcome=${outcome.status || "unknown"}`,
			`reason=${outcome.reason || "unknown"}`,
			`blockerLayer=${outcome.blockerLayer || "unknown"}`,
			`safetyOutcome=${outcome.safetyOutcome || "unknown"}`,
		],
		affectedLayers: compact([outcome.blockerLayer, ...layersForCapability(outcome.blockerCapability)]),
		expectedImpact: expectedImpactForCapability(outcome.blockerCapability),
		regressionRisk: regressionRiskForCapability(outcome.blockerCapability),
		suggestedScope: suggestedScopeForCapability(outcome.blockerCapability),
		candidateTests: candidateTestsForCapability(outcome.blockerCapability),
	})];
}

function buildBacklogProposalCandidates(report) {
	const items = report.backlog && report.backlog.items || [];
	return items
		.filter((item) => item.status !== "Monitoring")
		.map((item) => {
			const capability = mapBacklogAreaToCapability(item.area, item.issue);
			return proposalFromCapability(report, {
				capability,
				title: titleForCapability(capability),
				evidence: [
					`backlogPriority=${item.priority || "unknown"}`,
					`area=${item.area || "unknown"}`,
					`issue=${item.issue || "unknown"}`,
					`estimatedImpact=${item.estimatedImpact || "unknown"}`,
				],
				affectedLayers: layersForCapability(capability),
				expectedImpact: item.estimatedImpact || expectedImpactForCapability(capability),
				regressionRisk: regressionRiskForCapability(capability),
				suggestedScope: item.suggestedFix || suggestedScopeForCapability(capability),
				candidateTests: candidateTestsForCapability(capability),
			});
		});
}

function buildEfficiencyProposalCandidates(report) {
	const efficiency = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.efficiency || {};
	const repeated = Number(efficiency.repeatedFieldAttempts || 0);
	if (repeated <= 0) return [];

	return [proposalFromCapability(report, {
		capability: "Runtime State Planning",
		title: "Avoid repeated verified field attempts",
		evidence: [
			`totalActions=${efficiency.totalActions || 0}`,
			`repeatedFieldAttempts=${repeated}`,
			`redundantActionRatio=${efficiency.redundantActionRatio || 0}`,
		],
		affectedLayers: ["Decision", "Runtime State", "Task"],
		expectedImpact: repeated > 2 ? "High" : "Medium",
		regressionRisk: "Medium",
		suggestedScope: "Use runtimeState.completedFields to skip already verified field/profile pairs during planning.",
		candidateTests: [
			"decision-cycle skips fields already present in runtimeState.completedFields",
			"metrics-v2 counts repeated field attempts from executedActions",
		],
	})];
}

function proposalFromCapability(report, input) {
	return {
		capability: input.capability,
		title: input.title,
		evidence: unique(input.evidence),
		affectedLayers: unique(input.affectedLayers),
		expectedImpact: input.expectedImpact,
		regressionRisk: input.regressionRisk,
		suggestedScope: input.suggestedScope,
		candidateTests: unique(input.candidateTests),
		status: "proposed",
	};
}

function mergeCandidates(candidates) {
	const byKey = new Map();

	for (const candidate of candidates) {
		const key = `${candidate.capability}:${candidate.title}`;
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, candidate);
			continue;
		}

		byKey.set(key, {
			...existing,
			evidence: unique([...existing.evidence, ...candidate.evidence]),
			affectedLayers: unique([...existing.affectedLayers, ...candidate.affectedLayers]),
			expectedImpact: strongerImpact(existing.expectedImpact, candidate.expectedImpact),
			regressionRisk: strongerRisk(existing.regressionRisk, candidate.regressionRisk),
			suggestedScope: existing.suggestedScope || candidate.suggestedScope,
			candidateTests: unique([...existing.candidateTests, ...candidate.candidateTests]),
		});
	}

	return [...byKey.values()];
}

function scoreProposal(proposal, capabilityHistory) {
	const impact = { High: 30, Medium: 20, Low: 10 }[proposal.expectedImpact] || 0;
	const recurring = countRecurringCapability(proposal.capability, capabilityHistory) * 5;
	const blocker = proposal.evidence.some((item) => item.startsWith("taskOutcome=")) ? 15 : 0;
	return impact + recurring + blocker;
}

function countRecurringCapability(capability, capabilityHistory) {
	const records = capabilityHistory && capabilityHistory.records || [];
	return records.filter((record) => record.capability === capability && record.status !== "Validated").length;
}

function isVerifiedFieldSkipValidated(report) {
	const efficiency = report.metricsV2 && report.metricsV2.task && report.metricsV2.task.efficiency || {};
	const completedFieldCount = Number(report.metricsV2 && report.metricsV2.task && report.metricsV2.task.completedFieldCount || 0);
	return completedFieldCount > 0 && Number(efficiency.repeatedFieldAttempts || 0) === 0;
}

function mapBacklogAreaToCapability(area, issue) {
	const text = `${area || ""} ${issue || ""}`.toLowerCase();
	if (area === "Observation") return "Page Profile";
	if (text.includes("runtime")) return "Runtime State Planning";
	if (text.includes("policy") || text.includes("irreversible")) return "Safety / Policy";
	if (text.includes("verification")) return "Verification";
	if (text.includes("recovery")) return "Recovery";
	if (text.includes("profile")) return "Page Profile";
	if (text.includes("component") || text.includes("dropdown") || text.includes("radio") || text.includes("label") || text.includes("required field")) return "Field Identification";
	if (text.includes("reasoning") || text.includes("matching")) return "Semantic Matching";
	if (text.includes("navigation") || text.includes("login")) return "Policy Navigation";
	return "Field Identification";
}

function titleForCapability(capability) {
	const titles = {
		"Policy Navigation": "Improve safe application navigation",
		"Runtime State Planning": "Avoid repeated verified field attempts",
		"Field Identification": "Improve generic field identification",
		"Semantic Matching": "Improve semantic field matching confidence",
		Verification: "Improve action verification",
		Recovery: "Improve generic recovery handling",
		"Page Profile": "Improve deterministic page profiling",
		"Applicable Components": "Improve applicable component selection",
		"Safety / Policy": "Improve policy stop explainability",
	};
	return titles[capability] || `Improve ${capability}`;
}

function layersForCapability(capability) {
	const layers = {
		"Policy Navigation": ["Decision", "Page", "Safety / Policy"],
		"Runtime State Planning": ["Decision", "Runtime State", "Task"],
		"Field Identification": ["Observation", "Page", "Task"],
		"Semantic Matching": ["Decision", "Task"],
		Verification: ["Decision", "Task"],
		Recovery: ["Recovery", "Task"],
		"Page Profile": ["Page"],
		"Applicable Components": ["Page", "Benchmark"],
		"Safety / Policy": ["Decision", "Safety / Policy"],
	};
	return layers[capability] || ["Benchmark"];
}

function expectedImpactForCapability(capability) {
	if (capability === "Field Identification" || capability === "Runtime State Planning") return "High";
	if (capability === "Policy Navigation" || capability === "Semantic Matching" || capability === "Verification") return "Medium";
	return "Low";
}

function regressionRiskForCapability(capability) {
	if (capability === "Safety / Policy" || capability === "Policy Navigation") return "High";
	if (capability === "Runtime State Planning" || capability === "Field Identification" || capability === "Semantic Matching") return "Medium";
	return "Low";
}

function suggestedScopeForCapability(capability) {
	const scopes = {
		"Policy Navigation": "Adjust generic safe navigation policy and preserve final-submit blocking.",
		"Runtime State Planning": "Use runtime state evidence to avoid repeated or non-progressing actions across cycles.",
		"Field Identification": "Improve label association and required-field detection using generic semantic context.",
		"Semantic Matching": "Tune generic field/profile matching thresholds and evidence requirements.",
		Verification: "Improve action-specific verification using observed runtime state changes.",
		Recovery: "Add generic fallback strategies after classifying the blocking failure.",
		"Page Profile": "Refine deterministic page profile rules using semanticPage signals.",
		"Applicable Components": "Refine applicable component mapping from page profile signals.",
		"Safety / Policy": "Preserve final-submit blocking while improving policy explanations for safe stops.",
	};
	return scopes[capability] || "Collect more benchmark evidence before changing generic behavior.";
}

function candidateTestsForCapability(capability) {
	const tests = {
		"Policy Navigation": [
			"policy allows exact application-entry navigation links",
			"policy blocks final submit without human confirmation",
		],
		"Runtime State Planning": [
			"decision-cycle skips fields already present in runtimeState.completedFields",
			"metrics-v2 reports zero repeatedFieldAttempts after verified-field skip",
		],
		"Field Identification": [
			"component validator flags required fields without usable labels",
			"field matching does not choose unlabeled required fields without sufficient evidence",
		],
		"Semantic Matching": [
			"field matching ranks profile-property matches using semantic labels",
		],
		Verification: [
			"verified action runner requires observed state consistency",
		],
		Recovery: [
			"recovery engine records classified recovery failure evidence",
		],
		"Page Profile": [
			"page-profile classifies application-form and application-entry deterministically",
		],
		"Applicable Components": [
			"applicable-components derives required and optional components from page profile",
		],
		"Safety / Policy": [
			"policy stops irreversible submit actions without human confirmation",
		],
	};
	return tests[capability] || ["rwvs proposal evidence remains deterministic"];
}

function strongerImpact(a, b) {
	return stronger(a, b, ["Low", "Medium", "High"]);
}

function strongerRisk(a, b) {
	return stronger(a, b, ["Low", "Medium", "High"]);
}

function stronger(a, b, order) {
	return order.indexOf(b) > order.indexOf(a) ? b : a;
}

function compact(values) {
	return values.filter(Boolean);
}

function unique(values) {
	return [...new Set((values || []).filter(Boolean))];
}

module.exports = {
	buildImprovementProposals,
};
