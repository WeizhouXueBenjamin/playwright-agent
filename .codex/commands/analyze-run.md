# Browser AI Agent - Analyze Completed Run

## Purpose

Analyze an already completed production or benchmark run.

This is a post-run diagnostics workflow. It does not perform the active application task.

Do not reopen or interact with the target website unless artifacts are incomplete and the user explicitly requests a replay.

Do not modify source code.

---

# Inputs

Use the most recent run unless a run path or run ID is supplied.

Required evidence may include:

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
- benchmark report, when available
- metricsV2, when available
- healthV2, when available

If benchmark artifacts are unavailable, reconstruct the best possible production-run diagnosis from execution artifacts only.

---

# Workflow

Load Run Artifacts

-> Reconstruct Task Outcome

-> Build V2 Diagnostics

-> Identify Capability Gap

-> Generate Post-mortem

-> Generate Advisory Proposals

-> Update Capability History

Do not run the V1 regression gate unless explicitly requested.

Do not interact with the website during normal analysis.

---

# Required Outputs

Generate when enough evidence exists:

- reports/postmortem.md
- reports/improvement-proposals.json
- capability evolution entry
- capability-history.json
- recurring-issues.json or recurring-issues.md when prior runs exist

When benchmark data is available, also preserve:

- V1 result
- V2 metrics
- layered diagnosis
- efficiency metrics
- applicable coverage

---

# Analysis Rules

All conclusions must be derived from objective artifacts.

Do not use subjective numeric scoring.

Do not generate website-specific fixes.

Separate:

- task blocker
- technical failure
- safe stop
- user-data requirement
- unsupported capability
- policy restriction

A production run that safely reaches final review is a successful task even when no application is submitted.

---

# Task Outcome Reconstruction

Classify the completed run into one terminal outcome:

- ready-for-review
- needs-review
- login-required
- human-verification-required
- unsupported-component
- policy-stopped
- application-unavailable
- failed

Also classify product success outcome:

- success
- partial-success
- acceptable-degradation
- failure
- severe-failure
- severe-safety-failure

Use only objective evidence from execution status, terminal state, policy evaluation, verification results, runtime state, and failure reports.

---

# Capability Analysis

Map blockers and failures to generic capabilities:

- Policy Navigation
- Runtime State Planning
- Field Identification
- Semantic Matching
- Verification
- Recovery
- Page Profile
- Applicable Components
- Safety / Policy

Every capability gap must include artifact evidence and affected layers.

Do not create platform-specific capability labels.

---

# Improvement Proposals

Proposals are advisory only.

Each proposal must contain:

- capability
- title
- objective evidence
- affected layers
- expected impact
- regression risk
- suggested implementation scope
- candidate tests
- status

Allowed statuses:

- proposed
- accepted
- rejected
- deferred

Do not automatically edit source code.

Do not propose website-specific fixes.

If an issue is already fixed and the latest run validates the fix, record it as capability history instead of an open proposal.

---

# Post-mortem Format

`reports/postmortem.md` should include:

- Task Summary
- Product Success Outcome
- V1 Result, when benchmark data exists
- V2 Layer Diagnosis, when V2 data exists
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

The post-mortem is an engineering diagnostic report. It does not replace the concise production result shown to the user by apply.md.

---

# Capability History

Update cross-run capability artifacts when possible:

- capability-evolution-log.md
- capability-history.json
- recurring-issues.md
- recurring-issues.json

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

Recurring issues guide the next developer-approved generic fix. They must not change the completed run result.

---

# Final Response

Summarize:

- run analyzed
- terminal outcome
- product success outcome
- main blocker
- capability gap
- proposal count
- highest-priority proposal
- artifacts generated or updated

Clearly state that no source code was modified.
