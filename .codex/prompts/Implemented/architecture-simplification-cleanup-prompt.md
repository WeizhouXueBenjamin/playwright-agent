# Job Application Assistant — Architecture Simplification and Redundancy Cleanup

## Context

This project was initially evolving toward a general-purpose, production-grade Browser AI Agent platform.

It now contains or may contain:

- Observation v1 and v2
- Decision v1 and v2
- deterministic Decision Gate
- Runtime State
- Policy Engine
- Field Answer Safety Guard
- Capability Registry
- Recovery Engine
- RWVS and benchmark systems
- capability evolution history
- post-mortem generation
- improvement proposal generation
- decision provenance metrics
- AI provider abstractions
- shadow AI fixtures
- legacy deterministic planners
- fixed field-intent resolvers
- multiple overlapping diagnostics and reports

The actual product goal is much smaller:

- personal use
- zero additional API cost
- provide a job application URL
- automatically fill clear fields
- use simple semantic grouping for field variants
- ask the user when information is missing or ambiguous
- generate cover letters and open-question answers through Codex
- stop before final submission
- retain a lightweight benchmark and run-driven iterative-improvement loop

The current project may therefore be over-engineered.

---

# Objective

Simplify the repository into a maintainable personal job-application assistant.

Remove or freeze infrastructure that does not directly contribute to the current MVP.

Preserve only the components needed for:

- browser observation
- browser actions
- field filling
- simple profile matching
- human review
- document upload
- cover-letter generation
- open-question answer generation
- final-submit protection
- lightweight verification
- lightweight execution logs
- core regression tests
- selected historical replay cases
- run-driven diagnostics and advisory improvement proposals

Do not rewrite the project from scratch unless the existing architecture makes incremental simplification impractical.

---

# Core Product Boundary

The simplified product should support:

```text
Job URL
-> open application page
-> inspect visible fields
-> fill clear fields
-> upload configured documents
-> ask the user about ambiguous or missing answers
-> generate text for open questions when needed
-> stop before final submission
-> print a completion summary
-> save a compact run artifact
-> analyze recurring issues
-> replay selected historical failures
```

The project is not currently intended to be:

- a multi-user SaaS
- a multi-provider AI platform
- an autonomous browser-agent framework
- a benchmark research platform
- a self-modifying agent platform
- an ATS ontology engine
- a fully unattended application bot

---

# Phase 1 — Repository Inventory

Inspect the repository and create:

- `reports/simplification-audit.md`

For each major module, classify it as:

## Keep

Directly required for the MVP.

## Simplify

Useful, but currently more complex than necessary.

## Freeze

Leave in the repository temporarily, but remove from active workflows.

## Remove

Unused, duplicated, obsolete, or unrelated to the MVP.

At minimum inspect:

- observation contracts
- decision contracts
- decision gate
- planner
- next-action
- field matching
- profile properties
- location resolution
- work eligibility resolution
- safety guard
- policy engine
- capability registry
- executor
- verifier
- Runtime State
- recovery
- benchmark
- RWVS
- post-mortem
- capability evolution
- recurring issues
- improvement proposals
- AI provider abstractions
- shadow fixtures
- reports
- CLI commands
- package scripts
- tests

For every item include:

- file or directory
- current responsibility
- runtime usage
- duplication
- maintenance cost
- keep/simplify/freeze/remove decision
- reason
- migration impact

Do not delete files during Phase 1.

---

# Phase 2 — Define the Minimal Runtime

Design one primary runtime workflow:

```text
Observe
-> classify obvious fields
-> fill from profile
-> use Codex or ask the user for unresolved semantics
-> execute browser action
-> verify
-> repeat
-> stop before submit
```

The runtime should use one clear entry point.

Recommended CLI shape:

```bash
pnpm apply -- <job-url>
```

The simplified runtime should not require:

- shadow AI mode
- provider selection
- Decision v1/v2 dual execution
- capability history during normal runs
- full post-mortem generation for every successful run
- multiple health scores
- platform-specific branches

---

# Phase 3 — Components to Preserve

Preserve and simplify these concepts.

## Browser Observation

Keep:

- visible interactive controls
- label
- placeholder
- nearby text
- field type
- options
- required state
- current value
- stable reference for the current page snapshot

Avoid maintaining multiple observation schema versions unless compatibility is actively required.

## Browser Actions

Keep reusable operations for:

- fill text
- select option
- check or uncheck
- upload file
- click safe navigation controls
- wait and re-observe

Do not expose unrestricted arbitrary JavaScript as part of the normal workflow.

## Verification

Keep lightweight verification:

- text value changed
- selected option matches
- checkbox state matches
- upload field contains a file
- page changed after navigation

Do not retain complex verification taxonomies unless used by the active runtime.

## Profile

Keep one structured profile source.

## Human Review

Keep a console-based workflow for:

- accept suggestion
- edit suggestion
- skip field
- manually complete field
- continue after manual intervention

## Safety

Keep a small number of hard rules:

- never click final Submit
- legal/privacy declarations require confirmation
- do not invent salary expectations
- do not infer unsupported legal facts
- upload only configured files
- ask the user when uncertain

## Lightweight Benchmark and Iterative Improvement

Preserve:

- compact structured run artifacts
- a small authored core regression suite
- permanent safety regression tests
- selected historical failure replays
- automatic failure classification
- recurring issue aggregation
- advisory improvement proposals
- before/after replay comparison

Do not preserve research-oriented scoring or multi-layer health systems unless actively used.

---

# Phase 4 — Components to Simplify

## Decision Architecture

Replace dual Decision v1/v2 production complexity with one lightweight internal action proposal if possible.

Suggested shape:

```js
{
  action: "fill | select | check | upload | click | ask-user | generate-text | stop",
  fieldRef: "field-12",
  value: "Wellington",
  source: "profile.personal.city",
  reason: "Location field requests current city",
  requiresReview: false
}
```

A full enterprise-style decision contract is not required unless another active module depends on it.

Keep a simple validation step before execution.

## Runtime State

Reduce Runtime State to facts needed for the current session:

```js
{
  url,
  completedFields,
  skippedFields,
  reviewItems,
  recentActions,
  currentStatus
}
```

Do not store speculative reasoning in Runtime State.

## Recovery

Reduce recovery to:

1. re-observe
2. retry once for reversible actions
3. ask the user to complete manually
4. continue or stop

Remove complex recovery strategy taxonomies if they are no longer used.

## Diagnostics

Replace large report systems with one lightweight run report:

```json
{
  "url": "...",
  "status": "ready-for-review",
  "filled": [],
  "generated": [],
  "skipped": [],
  "manualReview": [],
  "failed": [],
  "submitted": false
}
```

---

# Phase 5 — Lightweight Benchmark and Iterative Improvement

Do not remove benchmarking completely.

Replace the existing research-oriented benchmark and self-improvement infrastructure with a lightweight run-driven improvement loop.

Required loop:

```text
Production Run
-> Structured Run Artifact
-> Automatic Diagnostics
-> Recurring Issue Aggregation
-> Advisory Improvement Proposal
-> Developer Approval
-> Regression Replay
```

## Run Artifact

Each application run should produce one compact artifact:

```json
{
  "runId": "run-...",
  "url": "...",
  "status": "ready-for-review",
  "filledFields": [],
  "generatedAnswers": [],
  "manualInterventions": [],
  "failures": [],
  "safetyStops": [],
  "submitted": false
}
```

Each field record should preserve:

- observed label
- control type
- available options
- selected answer
- profile source
- resolution method
- verification outcome
- whether the user intervened

## Failure Categories

Use a small stable taxonomy:

- `profile-data-missing`
- `semantic-resolution-failed`
- `ambiguous-profile-facts`
- `unsupported-control`
- `option-mismatch`
- `browser-action-failed`
- `verification-failed`
- `manual-review-required`
- `safety-blocked`
- `navigation-failed`
- `text-generation-review`

Do not create a new capability taxonomy for every field.

## Recurring Issues

Aggregate issues by normalized signature.

Example:

```json
{
  "signature": "visa-type-vs-visa-status",
  "category": "ambiguous-profile-facts",
  "occurrences": 3,
  "affectedRuns": ["run-1", "run-4", "run-9"],
  "status": "open"
}
```

Priority rules:

1. safety or final-submit risk
2. incorrect personal information
3. repeated blocking issue
4. recurring semantic confusion
5. one-off usability issue

## Improvement Proposals

Generate advisory proposals only.

Example:

```json
{
  "title": "Improve visa type and status selection",
  "evidence": [],
  "rootCause": "Both profile facts were plausible for the observed field.",
  "genericImprovement": "Give Codex both candidate facts and require an explicit selected source.",
  "candidateTests": [],
  "risk": "medium",
  "status": "proposed"
}
```

The system must not automatically modify production code.

The developer must explicitly:

- accept
- edit
- reject
- defer

## Regression Suite

Maintain:

- a small core regression suite
- permanent safety regression cases
- selected anonymized historical failure fixtures

Do not turn every real run into a permanent benchmark.

Add a historical case only when it represents:

- a previously incorrect answer
- a safety failure
- a recurring issue
- a new semantic variation
- a new browser control behavior

Recommended commands:

```bash
pnpm apply -- <job-url>
pnpm analyze:last-run
pnpm benchmark:core
pnpm benchmark:replay
pnpm benchmark:add-case -- <run-id>
```

---

# Phase 6 — Components to Freeze or Remove

Evaluate freezing or removing:

- unused AI provider abstractions
- OpenAI Responses API integration work not required by the zero-additional-cost runtime
- shadow AI decision infrastructure
- AI vs legacy comparison metrics
- decision provenance research metrics
- RWVS capability evolution prose
- full post-mortem generation for routine successful runs
- platform-name scoring
- page/task/benchmark health score layers
- duplicate benchmark schemas
- fixed page-intent ontology
- increasingly large field-intent ontology
- specialized location resolver authority
- specialized work-eligibility resolver authority
- implicit referral-source defaults

Do not remove:

- final-submit protection
- salary safeguards
- legal/privacy confirmation requirements
- core field verification
- lightweight regression/replay capability
- recurring issue analysis
- advisory improvement proposals

---

# Phase 7 — Semantic Rule Reduction

Do not continue expanding fixed regex and intent mappings for every field variation.

Retain only small alias groups for highly stable fields:

- first name
- last name
- email
- phone
- city
- country
- LinkedIn
- portfolio
- resume
- cover letter

For less stable fields, prefer:

- collecting field context
- presenting relevant profile facts
- asking Codex or the user to choose
- verifying the selected option exists

Patterns should generate candidates, not become a complete ATS ontology.

---

# Phase 8 — Safe Removal Process

For every removal:

1. prove the module is not used by the simplified runtime
2. remove imports and package scripts
3. update affected tests
4. remove obsolete reports
5. remove dead configuration
6. run the full active-runtime test suite
7. run core benchmark and safety replay
8. confirm final-submit protection still works

Avoid large destructive deletion in one commit.

Use small, reviewable cleanup phases.

---

# Required Tests

Retain or add tests for:

- opening and observing a form
- filling normal text fields
- selecting a native option
- checkbox handling
- resume upload
- skipping already completed fields
- ambiguous field becomes user review
- legal/privacy field requires confirmation
- salary field does not use unrelated profile data
- failed action retries once
- manual intervention can resume the workflow
- final Submit is never clicked
- run summary is generated
- recurring issue aggregation works
- improvement proposals are advisory only
- core regression fixtures replay
- historical failure replay works

Remove test suites that only cover deleted, inactive research infrastructure.

---

# Acceptance Criteria

The cleanup is complete when:

- there is one clear production apply workflow
- unused AI-provider infrastructure is not part of runtime
- research-heavy benchmark systems are simplified
- a lightweight run-driven improvement loop remains
- field matching no longer depends on a growing ontology
- ambiguous fields can be handled through user/Codex review
- core browser actions still work
- verification still works
- resume upload still works
- final submission remains blocked
- package scripts are understandable
- active modules have clear responsibilities
- core regression and replay tests pass
- repository complexity is materially reduced

---

# Required Final Report

Return:

1. modules kept
2. modules simplified
3. modules frozen
4. modules removed
5. files changed
6. active runtime flow
7. lightweight benchmark flow
8. iterative improvement flow
9. package scripts removed or added
10. tests retained and removed
11. remaining technical debt
12. confirmation that final-submit protection remains
13. confirmation that no application was submitted
14. recommended next development step

Do not begin major new feature development during this cleanup task.
