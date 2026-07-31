# Checkpoint-Based Batched Human Review

## Evaluation

The proposed direction is correct for this project: the agent should first complete low-risk, high-confidence actions, then gather the remaining user-judgment items into a batch review checkpoint.

The current generic menu:

```text
[A]ccept [E]dit [S]kip [M]anual [Q]uit
```

is too broad for the actual product workflow. Some review items have no editable value, such as legal or privacy consent. Some require user input, such as salary. Some require choosing from observed options. Some should only be inspected manually. Final submission must never be exposed as an accept-like action.

The optimization for this repository is not "Codex decides all difficult fields." The right boundary is:

```text
Deterministic code and Codex classify, explain risk, and propose actions.
The user authorizes or supplies decisions for sensitive, ambiguous, missing, or irreversible items.
The normal planner-policy-executor-verifier pipeline performs all page mutation.
```

Use checkpoint-based batched review, not immediate per-field interruption and not a single review after the whole multi-page application. Many applications have required consent or required fields that block navigation, so the agent can only batch up to the largest safe checkpoint currently visible.

## Scope

This is a medium-sized agent-loop improvement, not a small label change. Keep the first implementation deliberately narrow.

### V1 Must Deliver

- current-page safe fields are completed before review;
- current-page review items are batched into one checkpoint;
- browser remains open during review;
- V1 review types only:
  - `consent-authorization`
  - `confirm-proposed-value`
  - `manual-value-required`
  - `option-selection`
  - `file-required`
  - `final-review`
- CLI collects the whole batch decision set;
- controller re-observes after batch confirmation;
- authorized actions resume through the normal planner-policy-executor-verifier pipeline;
- checkpoint state and artifacts are additive;
- non-TTY runs save a pending checkpoint and exit cleanly;
- final-submit protection remains unchanged.

### Defer To V2

Do not implement these in V1 unless a current failing test or real-run artifact proves they are needed:

- configurable checkpoint size;
- automatic element focus, scroll, or highlight from the review UI;
- a separate `voluntary-disclosure` review type;
- a separate `ambiguous-field` review type;
- `not-applicable` semantics;
- cross-checkpoint decision editing history;
- previous/next/back review navigation beyond the smallest usable batch flow;
- partial checkpoint resolution.

Use metadata instead of new types where possible:

```js
{
  sensitive: true,
  voluntary: true,
  allowPreferNotToAnswer: true,
  ambiguityReason: "field-meaning-unclear"
}
```

## Objective

Replace the current per-field generic review prompt with a typed checkpoint review workflow:

```text
observe page
-> classify visible fields
-> execute safe high-confidence actions
-> verify actions
-> collect unresolved review items
-> continue safe actions on the same page
-> pause only at a checkpoint
-> present a batch of typed review items
-> collect and validate user decisions
-> re-observe page
-> execute only authorized decisions through the normal pipeline
-> verify
-> continue the same browser session
```

Do not weaken any product invariant in `.codex/prompts/PROJECT_DIRECTION.md`.

Preserve:

- personal local workflow
- zero additional API cost
- current-run-only user decisions
- explicit provenance for user-reviewed values
- browser stays open during interactive review
- no global profile mutation
- final-submit protection
- deterministic salary, legal, privacy, consent, and declaration safeguards

## Existing Code Context

Start from the current implementation:

- `src/agent/controller.js`
  - `resolveReview` handles one review item at a time.
  - It can resume the same browser run after answer, skip, or verified manual completion.
  - It records `explicit-user-review` answers in runtime state.

- `src/agent/next-action.js`
  - `determineNextAction` builds a plan, executes the first pending safe step, then returns only one blocking review item.
  - `findBlockingReviewItem` selects a single required item.

- `src/agent/planner.js`
  - `buildExecutionPlan` already separates `steps` from `reviewItems`.
  - This should become the foundation for batching, not be replaced by a larger agent protocol.

- `src/review/review-resolution.js`
  - `normalizeReviewPrompt` creates a single prompt.
  - `buildReviewAnswer` already creates run-scoped `explicit-user-review` answers.

- `src/cli/complete-application.js`
  - `createCliReviewAnswerProvider` currently renders the fixed `Accept/Edit/Skip/Manual/Quit` menu.
  - `buildCompactRunArtifact` maps `manualReview` into `manualInterventions`.

- `src/state/runtime-state.js` and `src/state/state-update-pipeline.js`
  - runtime state currently includes `manualReview` and `reviewAnswers`.
  - Add checkpoint fields additively; do not break existing artifacts or tests.

## Design

### Review Types

Introduce a small V1 typed review model:

```js
const REVIEW_TYPES = {
  CONSENT_AUTHORIZATION: "consent-authorization",
  CONFIRM_PROPOSED_VALUE: "confirm-proposed-value",
  MANUAL_VALUE_REQUIRED: "manual-value-required",
  OPTION_SELECTION: "option-selection",
  FILE_REQUIRED: "file-required",
  FINAL_REVIEW: "final-review",
};
```

Every review request must have exactly one type.

Do not show one universal action menu for all review items.

Do not add new review types for every semantic distinction. Use metadata for sensitive, voluntary, ambiguous, optional, and prefer-not-to-answer cases unless a real implementation need proves that a separate type is simpler.

### Allowed Actions

Use type-specific actions:

```js
const REVIEW_ALLOWED_ACTIONS = {
  "consent-authorization": ["authorize", "decline", "stop"],
  "confirm-proposed-value": ["confirm", "replace", "skip", "stop"],
  "manual-value-required": ["provide-value", "skip", "stop"],
  "option-selection": ["select", "prefer-not-to-answer", "skip", "stop"],
  "file-required": ["provide-file", "skip", "stop"],
  "final-review": ["keep-open", "finish-without-submit", "stop"],
};
```

Never expose `submit` as an action. Do not treat `authorize`, `confirm`, or `finish-without-submit` as generic acceptance.

Do not implement `view` as a V1 action. The headed browser is already open. The CLI may print the field label, surrounding text, current page URL, and option snapshot. If a later version adds scroll, focus, or highlight, model it separately as `inspect-only` and run it through an explicit policy gate because it can still mutate focus, scroll position, or event state.

`decline` means "the user refuses authorization for this current-run action." It is not a browser action. For a required consent or declaration, a decline should normally block the field action and end or pause the run with a clear reason. Do not map `decline` to clicking an on-page reject control unless a separate safe browser action is explicitly planned and approved by policy.

### Structured Review Request

Create a normalized request shape:

```js
{
  id: "review-...",
  checkpointId: "checkpoint-...",
  type: "consent-authorization",
  fieldId: "interactive-...",
  fieldFingerprint: "...",
  fieldIntent: "privacy-consent",
  fieldLabel: { text: "Recruitment Privacy Policy", source: "label" },
  controlType: "checkbox",
  fieldState: {
    currentValue: false,
    required: true,
    visible: true
  },
  options: [],
  proposedValue: true,
  proposedAction: {
    type: "check",
    value: true
  },
  riskLevel: "high",
  reasonCode: "LEGAL_CONSENT_REQUIRED",
  reason: "Checking this field represents explicit acceptance of a recruitment privacy policy.",
  assessment: "This checkbox is required to continue to the next step.",
  evidence: [
    "Visible required checkbox label",
    "Policy classified as legal/privacy consent"
  ],
  metadata: {
    sensitive: true,
    voluntary: false,
    allowPreferNotToAnswer: false
  },
  allowedActions: ["authorize", "decline", "stop"],
  status: "pending"
}
```

The assessment is advisory. It is not user authorization.

### Review Checkpoint

Group review requests into a checkpoint:

```js
{
  id: "checkpoint-...",
  pageUrl: "...",
  pageTitle: "...",
  createdAt: "...",
  reason: "required-review-items-block-navigation",
  items: [/* normalized review requests */],
  decisions: [],
  status: "waiting-for-user"
}
```

Create a checkpoint when:

1. no remaining safe autonomous action exists on the current page;
2. pending review items block navigation;
3. the final submission boundary is reached;
4. continuing would create safety or correctness risk.

Before opening a checkpoint:

1. finish all currently available safe actions;
2. verify them;
3. re-observe;
4. deduplicate review items by field fingerprint and statement fingerprint;
5. include only current-page unresolved items;
6. avoid asking about optional fields that can safely remain blank unless the product policy requires an explicit decision.

## Implementation Plan

### Phase 1: Add Review Classification

Add a small module under `src/review/`, for example:

```text
src/review/review-types.js
src/review/review-checkpoint.js
```

Responsibilities:

- classify current `reviewItem` objects into the V1 review types above;
- derive allowed actions;
- preserve existing `normalizeReviewPrompt` compatibility;
- include actual option snapshots for selects/radios;
- include `currentProfileValue` only when there is a real proposed value;
- classify legal/privacy/declaration/consent as `consent-authorization`;
- classify salary with no explicit safe value as `manual-value-required`;
- classify sensitive matched values that need confirmation as `confirm-proposed-value`;
- classify option-only questions as `option-selection`;
- represent optional demographic/self-identification questions as `option-selection` plus metadata such as `sensitive`, `voluntary`, and `allowPreferNotToAnswer`;
- classify final submit boundary as `final-review`.

Keep this classification heuristic small and policy-aligned. Do not build a large ATS ontology.

### Phase 2: Batch Current-Page Review Items

Extend `determineNextAction` or nearby planner code so it can return a checkpoint candidate after all safe steps for the page are exhausted.

Current behavior:

```text
plan.steps -> execute first safe step
if no step -> find one blocking review item
```

Target behavior:

```text
plan.steps -> execute first safe step
if no step and review items remain -> return needs-review-checkpoint with all relevant current-page items
if no review items and safe navigation exists -> navigate
```

Do not interrupt when the first review item is discovered if there is still a safe action available.

Do not require scanning future pages.

### Phase 3: Controller Checkpoint Handling

Add checkpoint support beside the existing single-item `resolveReview` path.

Requirements:

- preserve `resolveReview` behavior for compatibility where useful;
- add `resolveReviewCheckpoint` for a batch;
- set runtime status to `review-pending` while waiting;
- keep browser/page/context open;
- collect decisions without mutating the page immediately after each individual decision;
- validate all decisions before resuming;
- store decisions as current-run scoped review answers or skipped/manual records as appropriate;
- treat deny/decline decisions as constraints, not page actions;
- re-observe before executing authorized actions;
- require later planner actions to match a recorded checkpoint decision when the field required review;
- mark checkpoint items resolved only after action verification.

The terminal UI must record decisions only. Browser mutation remains owned by the existing planner, policy, executor, and verifier path.

### Phase 4: CLI Review UI

Replace the fixed menu in `createCliReviewAnswerProvider` with typed prompts.

Checkpoint summary example:

```text
Human review checkpoint

Completed automatically:
- 10 verified fields
- 0 unsafe actions
- 0 final submission actions

Pending review:
1. Recruitment privacy policy - authorization required
2. Expected salary - manual value required
3. Voluntary demographic question - optional selection

The browser remains open.
No page actions will occur until you confirm the review batch.
```

Consent example:

```text
[1] Recruitment Privacy Policy
Type: Legal/privacy consent
Current state: Not selected
Agent assessment: This required checkbox represents acceptance of the employer's recruitment privacy policy.

[A] Authorize this checkbox
[D] Decline
[Q] Stop run
```

Manual value example:

```text
[2] Expected salary
Type: Sensitive manual answer
Current state: Empty
Agent assessment: No verified salary expectation exists in the current profile.

[I] Input value
[S] Skip
[Q] Stop run
```

Confirm value example:

```text
[3] Work authorization
Suggested answer: Yes
Basis: Explicit current-run or profile value, with matching field meaning.

[C] Confirm suggested value
[R] Replace with another value
[S] Skip
[Q] Stop run
```

Select option example:

```text
[4] Preferred office location
Options:
[1] Auckland
[2] Wellington
[3] Christchurch

[S] Skip
[Q] Stop run
```

Final checkpoint confirmation:

```text
Review decisions

1. Recruitment privacy policy: authorized for this field and current run
2. Expected salary: NZD 85,000
3. Voluntary demographic question: Prefer not to answer

[R] Resume application
[Q] Stop run
```

Do not show `Accept` where there is no proposed answer. Do not show `Edit` for legal consent. Do not use `Manual` as a catch-all label when the required user action is more specific.

For V1, do not offer a `View` command that scrolls, focuses, highlights, or otherwise touches the page. Print enough field context for review and remind the user that the headed browser is open on the relevant page.

### Phase 5: Runtime State and Artifact

Add fields additively:

```js
{
  reviewCheckpoints: [
    {
      id: "checkpoint-...",
      reason: "...",
      pageUrl: "...",
      pageTitle: "...",
      items: [],
      decisions: [],
      status: "resolved"
    }
  ],
  pendingReviewCheckpoint: null,
  interactiveReview: {
    enabled: true,
    checkpointCount: 1,
    resolvedItemCount: 3
  }
}
```

For non-interactive runs:

```js
{
  status: "needs-review",
  pendingReviewCheckpoint: {
    items: [/* all current checkpoint items */]
  }
}
```

Preserve existing `manualReview`, `reviewAnswers`, `skippedFields`, and compact artifact fields so current analysis scripts and tests continue to work.

Review artifacts must follow data minimization:

- do not persist raw sensitive answers unless required to resume the current run;
- prefer category, source, resolution method, and verification status over full values;
- redact salary, demographic/self-identification answers, and free-text sensitive answers in summary artifacts where resumption does not require raw values;
- never persist document contents;
- avoid persisting full local document paths in compact summaries when a filename or document category is sufficient;
- preserve enough statement fingerprint and options snapshot data to prove legal/privacy authorization was current-run and statement-scoped.

### Phase 6: Non-Interactive Behavior

When stdin is unavailable:

1. complete all safe autonomous actions available before the checkpoint;
2. collect the full current checkpoint;
3. save it to the runtime state and artifact;
4. return `needs-review`;
5. close resources cleanly;
6. do not hang waiting for input.

The existing `createReviewAnswerProvider` currently throws when no TTY exists. Adjust the apply flow so non-interactive mode can still run to a checkpoint and write an artifact instead of failing before the agent starts.

## Tests

Add focused tests without creating a large browser-agent framework.

### Planner and Checkpoint Tests

Verify:

- safe fields are returned before review checkpoints;
- multiple review items are included in one checkpoint after safe actions are exhausted;
- optional non-blocking fields can remain unresolved when safe;
- final review checkpoint never exposes submit.

### Controller Tests

Use local data URLs like the existing `src/agent/controller.test.js`.

Cover:

- page with first name, email, privacy consent, salary, optional disclosure;
- safe fields complete first;
- checkpoint contains all available review items;
- browser remains open during checkpoint;
- individual decisions do not mutate page until checkpoint confirmation;
- after confirmation, controller re-observes and then executes through the normal pipeline;
- missing or changed fields return to review rather than using stale identifiers.

### CLI Tests

Cover:

- consent prompt does not offer edit;
- manual value prompt does not offer accept without a proposed value;
- select prompt displays observed options;
- final review prompt does not offer submit;
- decline records refusal without performing a browser action;
- stop behaves predictably.

### Artifact Tests

Cover:

- resolved checkpoint is recorded;
- non-interactive checkpoint is saved as pending;
- existing `manualInterventions` output remains backward compatible;
- raw sensitive answers are redacted from compact summaries unless required for same-run resumption;
- `submitted` and `finalSubmissionTriggered` remain false.

### Regression Tests

Run:

```bash
pnpm test:mvp
```

Also run any focused test command available for planner/controller/review modules. If browser installation, network, credentials, or sandboxing prevents a test from running, report the exact blocker and do not weaken assertions.

## Acceptance Criteria

- Low-risk, high-confidence fields are completed before human review.
- Multiple current-page review items are batched into one checkpoint.
- Review actions are type-specific.
- V1 uses the minimal review type set and metadata instead of a growing review ontology.
- Legal/privacy consent requires explicit current-run authorization for the exact statement.
- Declining consent is recorded as refusal/constraint, not a page action.
- Salary is never inferred from role, skills, experience, or seniority.
- User decisions remain current-run scoped and do not mutate the profile.
- The browser stays open during interactive review.
- The V1 CLI does not perform automatic view, scroll, focus, or highlight actions.
- After review, the page is re-observed before any authorized action executes.
- The terminal UI does not mutate the page directly.
- Non-interactive runs write a full pending checkpoint artifact and exit cleanly.
- Compact artifacts minimize sensitive raw values.
- Final submission cannot be authorized by any review response.
- Existing compact artifact consumers remain compatible.
- Focused tests and MVP regression tests pass or report concrete external blockers.

## Out of Scope

Do not add:

- paid model API requirements;
- multi-provider infrastructure;
- a general-purpose browser-agent protocol;
- ATS-specific selector packages;
- large semantic ontologies;
- configurable checkpoint size in V1;
- automatic review-time view/focus/scroll/highlight in V1;
- separate voluntary-disclosure or ambiguous-field review types in V1;
- autonomous final submission;
- global profile learning from review answers;
- automatic production-code edits from run diagnostics.

Keep the implementation small, local, and reviewable.
