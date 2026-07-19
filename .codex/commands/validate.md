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

---

# Target Website

<https://eit.qjumpersjobs.co/jobs/details/Systems_Support_Technician%2C_Auckland-1103989?source=seek&seek-token=2JENkw7A6VpqExvEFvP8pG>

---

# Objective

Evaluate the Browser AI Agent against this real ATS website.

Treat this website as:

Benchmark #001

The purpose is **not** to complete an application.

The purpose is to discover weaknesses in the Browser AI Agent.

---

# Execution Rules
Execution Mode: headed

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

- component coverage
- confidence
- unsupported components
- ambiguous detections

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

For every failure include:

- description
- root cause
- affected subsystem
- impact
- reproducibility
- recommended generic improvement

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

Include:

- success rate
- component coverage
- execution time
- recovery count
- verification failures
- runtime errors
- benchmark score

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

8. Regression Summary

9. Agent Health Score

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
