# Browser AI Agent Continuous Validation

## Context

The Browser AI Agent is validated through benchmark-driven continuous improvement.

Use the full Continuous Improvement Loop:

Benchmark
-> Diagnostics
-> Capability Analysis
-> Improvement Proposal
-> Regression Replay
-> Capability History

Benchmark Model V2 is additive. Do not remove, rename, or reinterpret existing V1 fields.

V1 is the compatibility and regression track:

- summary
- metrics
- health
- caseResults
- schemaVersion=1 reports
- legacy component coverage
- V1 regression gate

V2 is the diagnostics and explainability track:

- metricsV2
- healthV2
- Page Profile
- Applicable Components
- Applicable Coverage
- Decision Metrics
- Efficiency Metrics
- Task Outcome
- layered Observation / Decision / Page / Task / Benchmark diagnosis

Do not use V2 metrics to fail the existing V1 regression gate unless the benchmark tooling explicitly supports that later.

Do not automatically modify source code during validation. Generate advisory improvement proposals only. Any suggested improvement must cite objective artifact evidence.

---

# Target Website

Default benchmark target:

<https://job-boards.greenhouse.io/released/jobs/7802196003>

When a dataset path is supplied, use that dataset instead of the default target.

---

# Objective

Evaluate the Browser AI Agent against real ATS benchmark data.

The purpose is not to submit an application.

The purpose is to discover, explain, and prioritize generic Browser AI Agent capability gaps using objective artifacts.

---

# Execution Rules

Execution Mode: headed, persistent

Browser: Chromium

Viewport: Desktop

Always stop before irreversible actions.

Never:

- submit an application
- confirm final submission
- create an account
- perform an action that cannot be safely reversed

Every interaction must follow:

Observe
-> Decide
-> Execute
-> Verify
-> Update Runtime State

All metrics and proposals must be derived from artifacts:

- observationReport
- validationReport
- executionReport
- executionTimeline
- runtimeTimeline
- finalRuntimeState
- semanticPage
- policyEvaluation
- verificationResults
- failureReport
- backlog
- metricsV2
- healthV2
- postmortem
- improvementProposals
- capability history

Do not use LLM subjective scoring for metrics, health, proposal ranking, or capability status.

---

# Phase 1 - Benchmark

Run the complete RWVS benchmark pipeline for the target dataset or website.

Generate and preserve all normal RWVS artifacts.

Required outputs:

- reports/benchmark-report.json
- reports/benchmark.md
- reports/observation-report.json
- reports/validation-report.json
- reports/execution-report.json
- reports/failure-report.json
- reports/backlog.json
- reports/improvement-summary.json

V1 compatibility outputs must remain present and unchanged:

- summary
- metrics
- health
- caseResults
- validationReport.componentValidation.coverage.coverageRatio

---

# Phase 2 - Diagnostics

Use Benchmark Model V2 as the diagnostics track.

Required V2 outputs:

- metricsV2
- healthV2
- metricsV2.pageProfile
- metricsV2.applicableComponents
- metricsV2.coverage.legacyCoverageRatio
- metricsV2.coverage.applicableCoverageRatio
- metricsV2.decision
- metricsV2.task.efficiency
- metricsV2.task.outcome

Report objective diagnostics for:

- Observation metrics
- Decision metrics
- Page metrics
- Task metrics
- Benchmark metrics
- Layered Health
- Task Outcome
- Efficiency Metrics

Decision metrics must be derived only from:

- executionTimeline
- policyEvaluation
- verificationResults
- runtimeTimeline
- finalRuntimeState

Efficiency metrics must be derived only from:

- executedActions
- executionTimeline
- runtimeTimeline
- finalRuntimeState.completedFields

---

# Phase 3 - Capability Analysis

Map failures and task outcomes to generic capabilities.

Capability taxonomy:

- Policy Navigation
- Runtime State Planning
- Field Identification
- Semantic Matching
- Verification
- Recovery
- Page Profile
- Applicable Components
- Safety / Policy

Required capability outputs:

- capability-evolution-log.md
- capability-history.json

Every capability entry must include objective evidence:

- benchmark id
- platform
- result
- pageProfile
- task outcome
- capability gap
- evidence
- generic improvement
- status
- affected layers

Do not create website-specific capability labels or platform-specific fixes.

---

# Phase 4 - Improvement Proposal

Generate advisory improvement proposals.

Required output:

- reports/improvement-proposals.json

Each proposal must include:

- capability
- title
- evidence
- affectedLayers
- expectedImpact
- regressionRisk
- suggestedScope
- candidateTests
- status

Allowed statuses:

- proposed
- accepted
- rejected
- deferred

Proposal generation rules:

- derive from failureReport, metricsV2.task.outcome, metricsV2.decision, metricsV2.task.efficiency, and backlog
- rank recurring or high-impact capability gaps higher
- rank policy/safety risks highest
- do not generate website-specific fixes
- do not automatically modify source code
- cite artifact evidence for every recommendation

If repeated verified fields are already fixed, do not create an open Runtime State Planning proposal for that issue. It should appear as validated capability history instead.

---

# Phase 5 - Regression Replay

Run the V1 regression gate exactly as implemented.

V1 regression behavior is compatibility-critical and must remain unchanged.

Report:

- regression status
- previous V1 metrics, if available
- current V1 metrics
- regressions detected by the V1 gate

V2 may be shown for diagnostics, but V2 must not fail the existing V1 regression flow.

---

# Phase 6 - Post-mortem

Generate an engineering post-mortem after each RWVS run.

Required output:

- reports/postmortem.md

The post-mortem must include:

- Task Summary
- V1 Result
- V2 Layer Diagnosis
- Page Profile
- Applicable Coverage
- Decision Metrics
- Efficiency Metrics
- Task Outcome
- Blocking Issue
- Capability Gap
- Evidence
- Suggested Generic Improvement
- Regression Replay Result, if available

The post-mortem must be derived from:

- metricsV2
- healthV2
- failureReport
- backlog
- executionReport
- regression result

The post-mortem does not replace benchmark.md. It is an engineering diagnostic report.

---

# Phase 7 - Capability History

Update cross-run and cross-benchmark capability artifacts.

Required outputs:

- capability-evolution-log.md
- capability-history.json
- recurring-issues.md, if available
- recurring-issues.json, if available

Recurring issue fields:

- capability
- occurrences
- platforms
- benchmarks
- firstSeen
- lastSeen
- priority
- status
- relatedImprovements

Priority rules:

- policy and safety issues are highest priority
- verification regressions are high priority
- multi-platform recurring capability gaps are promoted
- single-platform low-impact issues remain low priority

Recurring Issues should guide the next developer-approved generic fix. They must not change the current RWVS result.

---

# Required Final Output

Summarize the run using these sections:

1. V1 Metrics
2. V2 Metrics
3. Task Outcome
4. Efficiency Metrics
5. Post-mortem
6. Improvement Proposals
7. Capability Evolution Log
8. Recurring Issues, if available
9. Regression Replay Result
10. Artifact Evidence

Every conclusion or suggested improvement must reference the artifact that supports it.

The final summary must clearly state:

- V1 is the compatibility/regression track
- V2 is the diagnostics/explainability track
- no source code was automatically changed by validation
- any future code change requires developer approval and should be generic

---

# Success Criteria

Validation succeeds when:

- all required artifacts are generated
- V1 metrics and V1 regression gate remain intact
- V2 diagnostics explain the observed behavior using objective data
- postmortem.md provides an engineering diagnosis
- improvementProposals are advisory and evidence-backed
- capability history is updated
- recurring issues are refreshed when prior benchmark artifacts are available
- no application is submitted
- no account is created
- no website-specific code change is proposed as the default path
