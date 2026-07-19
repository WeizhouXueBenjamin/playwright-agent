# Browser AI Agent Benchmark

## Context

The Browser AI Agent has completed its current implementation phases.

The project's immediate priority is no longer architectural refinement.

The primary objective is to validate the agent on real-world ATS platforms and improve it through benchmark-driven iteration.

Follow the current development strategy:

Benchmark

↓

Analyze

↓

Implement the smallest generic improvement

↓

Benchmark Again

↓

Compare

↓

Repeat

Do not perform speculative architectural work.

Do not introduce abstractions unless benchmark evidence demonstrates the need.

Benchmark Model V2 is additive. Preserve existing V1 report fields and V1 regression behavior, and reuse the dual-track V1/V2 output for explanation.

V1 remains the compatibility and regression track.

V2 is the explainability track:

- Observation metrics
- Decision metrics
- Page metrics
- Task metrics
- Benchmark metrics
- layered health scores
- Page Profile
- Applicable Components

---

# Target Website

<https://job-boards.greenhouse.io/released/jobs/7802196003>

---

# Objective

Evaluate the Browser AI Agent against this real ATS website.

Treat this website as:

Benchmark #001

The purpose is **not** to complete an application.

The purpose is to discover weaknesses in the Browser AI Agent.

---

# Execution Rules
Execution Mode: headed, persistent

Browser: Chromium

Viewport: Desktop

Follow the complete validation pipeline.

Observe

↓

Reason

↓

Decide

↓

Execute

↓

Verify

↓

Update Runtime State

↓

Benchmark

↓

Analyze

↓

Repeat

Always stop before any irreversible action.

Never submit an application.

Never create an account.

Never perform any action that cannot be safely reversed.

---

# Phase 1 — Passive Observation

Without interacting with the page:

Collect:

- DOM snapshot
- Accessibility Tree
- Screenshot
- Browser metadata
- Console messages
- Network errors
- Initial Runtime State
- Observation artifacts

Determine:

- page type
- ATS platform
- application entry point
- authentication requirements
- upload requirements
- required fields
- obvious blockers

Do not click anything unless required to continue observation.

Generate:

Observation Report

---

# Phase 2 — Component Validation

Validate whether the agent correctly detects:

- buttons
- text inputs
- dropdowns
- radio groups
- checkboxes
- upload components
- required indicators
- validation messages
- navigation elements
- application workflow

Measure:

- V1 legacy fixed component coverage
- V2 applicable component coverage
- confidence
- unsupported components
- ambiguous detections

Validate V2 fields:

- pageProfile.type
- pageProfile.evidence
- applicableComponents.required
- applicableComponents.optional
- legacyCoverageRatio
- applicableCoverageRatio
- missingApplicableComponents
- non-applicable V1 missing-component noise

Generate:

Component Validation Report

---

# Phase 3 — Controlled Execution

Begin interacting with the website.

Allow:

- navigation
- clicking
- typing
- uploads
- recovery

Do NOT:

- submit the application
- confirm final submission
- create accounts
- perform irreversible actions

Every interaction must follow:

Observe

↓

Decision

↓

Execute

↓

Verify

↓

Runtime State Update

If verification fails:

Attempt recovery.

Continue benchmarking whenever safe.

Decision metrics must be derived from execution artifacts only:

- executionTimeline
- verificationResults
- policyEvaluation
- runtimeTimeline
- finalRuntimeState

Do not use LLM subjective scoring for decision correctness.

---

# Phase 4 — Failure Analysis

Every failure must be classified.

Examples:

Observation

Semantic Matching

Reasoning

Decision

Planning

Execution

Verification

Recovery

Locator Resolution

Runtime State

Policy

Page Profile

Applicable Components

For every failure include:

- description
- root cause
- affected subsystem
- impact
- reproducibility
- recommended generic improvement
- whether V1 or V2 explains it better

Avoid website-specific fixes.

---

# Phase 5 — Improvement Planning

Rank improvements by expected impact.

Prefer improvements that increase:

- robustness
- generalization
- verification accuracy
- recovery success

Reject improvements that only solve this website.

---

# Phase 6 — Benchmark Summary

Generate:

- benchmark.md
- backlog.md
- regression.md
- health.md

Include V1 compatibility metrics:

- success rate
- legacy component coverage
- execution time
- recovery count
- verification failures
- runtime errors
- legacy health score
- V1 regression status

Include V2 explainability output:

- Page Profile
- Applicable Coverage
- Decision Metrics
- Layered Health
- V1 vs V2 Explainability
- Observation / Decision / Page / Task / Benchmark layer diagnosis

Do not treat a V2 score increase as the primary success criterion.

The primary V2 success criterion is better explainability from objective report data.

---

# Deliverables

Produce:

1. Executive Summary

2. Observation Report

3. Component Validation Report

4. Execution Report

5. Failure Analysis

6. Improvement Backlog

7. Benchmark Metrics

8. V2 Layered Metrics

9. Regression Summary

10. Agent Health Score

11. V1 vs V2 Explainability Summary

---

# Development Constraints

Use benchmark evidence to guide all conclusions.

Do not recommend architectural changes unless they directly address observed benchmark failures.

Implement only the highest-priority generic improvement after the benchmark.

Do not solve multiple unrelated issues in one iteration.

If a change cannot be justified by benchmark evidence, defer it.

The success criterion is not "cleaner architecture."

The success criterion is:

- higher benchmark success rate
- better verification accuracy
- improved recovery
- fewer regressions
- more reliable execution on real ATS platforms.
