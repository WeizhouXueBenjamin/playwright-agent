# Review Resolution Loop

> Superseded for current implementation work by `Human Review Hold and Resume.md`. This document describes the earlier review-contract milestone, most of which is already implemented.

## Context

Field Answer Safety Guard has sealed the P0 correctness issue:

- salary expectation is no longer polluted by `targetRole`, `jobTitle`, or experience titles
- work authorization and other sensitive fields stop with `needs-review` when value format or legal meaning is incompatible
- unsafe sensitive actions are rejected before they become executable steps

The next product bottleneck is not more guard taxonomy.

The next bottleneck is human-in-the-loop review resolution:

`needs-review` should become a recoverable product interaction, not the end of the task.

---

# Objective

Implement a Review Resolution Loop that lets the agent:

1. stop on a required review item
2. present the exact field, visible question, options, and safety reason
3. collect an explicit user answer
4. store that answer as run-scoped evidence with provenance
5. resume the current run from the blocked page
6. execute and verify the resolved field
7. continue the application until review, another blocker, or final-submit stop

This must be a production workflow improvement, not a benchmark-only feature.

---

# Feasibility Assessment

This is feasible with the current architecture.

Existing support:

- `planner.js` already creates review items.
- `next-action.js` already returns `needs-review`.
- `terminal-state.js` already marks `needs-review` as terminal.
- `controller.js` owns the active page loop and can resume if a review item is resolved.
- `StateManager` already stores runtime facts and can be extended with additive run-scoped review answers.
- `field-answer-safety.js` safety decisions can explain why review is required.

Current gap:

- `needs-review` currently returns from the controller and ends the run.
- there is no run-scoped explicit answer store.
- there is no user-answer provenance contract.
- there is no resume path that injects a user answer back into planning without restarting the whole page.

Main risk:

- accidentally persisting sensitive answers globally or reusing consent across sites.

Mitigation:

- default every review answer to `scope: "current-run"`.
- do not write review answers back to the profile unless a separate explicit save workflow is added later.
- consent/declaration answers must remain scoped to the exact current statement or fingerprint.

---

# Product Principle

For high-risk fields:

Safety stop + clear user question + resume

is better than:

weak matching + guessed answer + apparent completion

`needs-review` is not automatically a failure.

Product success outcomes should distinguish:

- ready-for-review
- needs-review-resumable
- partial-success
- protected-stop
- failure
- severe-safety-failure

---

# Review Answer Contract

Add a reusable run-scoped answer shape.

Recommended structure:

```js
{
	fieldIntent: "work-authorization",
	fieldFingerprint: "...",
	fieldId: "question-123",
	fieldLabel: {
		text: "Are you legally authorized to work in New Zealand?",
		source: "label"
	},
	answer: "Yes",
	answerType: "selection",
	source: "explicit-user-review",
	scope: "current-run",
	authorizedAt: "2026-07-20T00:00:00.000Z",
	safetyReasonResolved: "sensitive-field-value-format-mismatch",
	reusePolicy: "do-not-reuse",
	statementFingerprint: "",
	optionsSnapshot: [
		{ label: "Yes" },
		{ label: "No" }
	]
}
```

Required fields:

- fieldIntent
- fieldFingerprint
- answer
- source
- scope
- authorizedAt
- safetyReasonResolved

Do not include subjective reasoning or confidence fields in Runtime State.

Use objective provenance only.

---

# Phase 0 - Review Item Presentation

Goal:

Make `needs-review` actionable for the user.

Implement:

- normalize planner review items into a user-facing review prompt
- include exact field label/question
- include visible options when available
- include current profile value when relevant
- include safety reason from `safetyDecision`
- include the minimum information needed to continue

Example output:

```text
Review required:
Are you legally authorized to work in New Zealand?

Available answers:
- Yes
- No

Profile evidence:
"Open work visa valid until ..."

The agent did not convert this to Yes/No because it is a legal eligibility question.

Please choose one answer to continue.
```

Acceptance:

- review output is concise and actionable
- salary/legal/privacy/referral blockers explain why the agent did not guess
- no full benchmark diagnostics appear in production output

Tests:

- review item with safety decision produces exact blocker summary
- review item with options lists options
- unlabeled required field still asks for minimal user input

---

# Phase 1 - Run-scoped Review Answer Store

Goal:

Record explicit user answers without permanently mutating the profile.

Implement:

- extend Runtime State additively with `reviewAnswers` or equivalent run-scoped store
- add StateManager method or state patch builder to record a review answer
- preserve provenance:
  - source: `explicit-user-review`
  - scope: `current-run`
  - authorizedAt
  - field fingerprint
  - safety reason resolved
  - options snapshot, when available
- keep consent/declaration answers scoped to exact current statement/fingerprint

Acceptance:

- explicit review answer is available to subsequent planning cycles
- profile JSON is not modified
- broad consent is not persisted or reused across sites
- Runtime State contract still rejects subjective keys such as `confidence` and `reasoning`

Tests:

- recording review answer updates runtime state
- forbidden subjective keys are still rejected
- consent answer stores statement fingerprint
- review answer does not modify profile object

---

# Phase 2 - Planning With Explicit Review Answers

Goal:

Allow resolved fields to become executable only after explicit user input.

Implement:

- update field matching or planning to check run-scoped review answers before generic profile matches for the same field fingerprint/intent
- convert matching review answer into an action step
- mark the action source/provenance as explicit user review
- still run field-answer-safety value compatibility against the user answer
- if the user answer is incompatible with available options or field type, request review again with a clearer message

Acceptance:

- a blocked work authorization Yes/No field can be filled after user selects Yes or No
- salary field can be filled after user provides explicit compatible salary answer
- privacy/consent can only be resolved by explicit authorization for the current statement
- unrelated fields cannot consume review answers

Tests:

- review answer resolves matching field fingerprint
- review answer does not apply to a different field
- incompatible review answer produces another review item
- consent answer requires matching statement fingerprint

---

# Phase 3 - Resume Current Run

Goal:

Continue from the blocked page after review resolution without restarting the whole task.

Implement:

- add a controller-level resume path for resolved review items
- keep the same browser page/context when possible
- after recording review answer, continue the Observe -> Decide -> Execute -> Verify -> Update Runtime State loop
- verify the resolved field before marking it complete
- stop again on next review blocker or final submission policy

Acceptance:

- resolving one blocker continues from current page
- completed fields are not repeated
- verified resolved fields are added to completedFields
- max cycle behavior remains bounded
- final submission still requires manual user action

Tests:

- controller resumes after injected review answer
- verified review answer updates completedFields
- already completed fields are skipped after resume
- final submit remains `awaiting-human-confirmation`

---

# Phase 4 - Product Summary And Safety Metrics

Goal:

Make review resolution visible in production summaries and diagnostics.

Add objective metrics where existing structures allow additive fields:

```js
safetyMetrics: {
	highRiskFieldsDetected,
	unsafeMatchesRejected,
	incompatibleValuesRejected,
	sensitiveReviewItemsCreated,
	reviewAnswersProvided,
	reviewAnswersApplied,
	unsafeActionsExecuted
}
```

Success target:

```text
unsafeActionsExecuted = 0
```

Product summary should include:

- terminal outcome
- product success outcome
- review items resolved
- remaining unresolved items
- sensitive answers protected
- confirmation that no final submission occurred
- exactly one next user action

Acceptance:

- `needs-review` can be reported as protected/resumable, not generic failure
- summaries are concise and user-facing
- benchmark/V2 diagnostics can consume safety metrics later
- V1 regression behavior remains unchanged

Tests:

- safety metrics count rejected unsafe matches
- safety metrics count applied review answers
- unsafe executed action count remains zero for guarded fields

---

# Non-goals

Do not:

- weaken Field Answer Safety Guard to improve apparent completion
- persist sensitive answers globally by default
- auto-save user answers to profile
- reuse consent across websites or statements
- auto-submit applications
- turn production apply into full benchmark validation
- add website-specific fixes

---

# Greenhouse Replay Validation

After implementation, rerun the Greenhouse apply workflow.

Expected improved behavior:

1. agent stops on work authorization or salary/legal/privacy/referral blocker
2. user receives exact question, options, and why the agent needs confirmation
3. user provides explicit run-scoped answer
4. agent resumes from current page
5. resolved field is executed and verified
6. agent continues until next blocker or final-submit stop
7. no final submission occurs

Passing replay does not require completing every field.

It requires:

- no incorrect sensitive entries
- unsafeActionsExecuted = 0
- review answer provenance captured
- resolved blocker does not force full page restart

---

# Required Tests

Run focused tests first:

- `pnpm test:planner`
- `pnpm test:decision-cycle`
- `pnpm test:controller`
- `pnpm test:partial-execution`
- `pnpm test:state`

Run V2/RWVS tests if diagnostics or report fields change:

- `pnpm test:metrics-v2`
- `pnpm test:rwvs`

---

# Final Report

Summarize:

- phases implemented
- files changed
- review answer contract added
- runtime state changes
- how user answer provenance is stored
- tests run
- Greenhouse replay result, if run
- confirmation that no final submission occurred
- remaining blockers
