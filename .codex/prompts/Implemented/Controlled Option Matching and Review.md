# Controlled Option Matching and Review

## Instruction Authority

Before planning or changing code:

1. read `AGENTS.md`
2. read `.codex/prompts/PROJECT_DIRECTION.md` in full
3. inspect the current worktree and preserve unrelated user changes
4. evaluate the implementation against the Development Decision Checklist in `PROJECT_DIRECTION.md`

`PROJECT_DIRECTION.md` is authoritative. Stop and explain any conflict before modifying code.

## Objective

Improve option matching for native selects and custom ARIA comboboxes without increasing incorrect selections.

The implementation must support this verified real-run case:

```text
Field: Work Eligibility*
Explicit profile fact: New Zealand Permanent Resident visa
Current proposed value: Citizen or Permanent Resident Visa
Observed live option: Citizen or Permanent Resident
```

The current run incorrectly reaches:

```text
recovery-needs-user-confirmation
Expected one compatible live option for "Citizen or Permanent Resident Visa", found 0.
```

The desired behavior is not a one-off string replacement. Build a small, deterministic, risk-aware option resolver that recognizes tightly controlled semantic equivalence, rejects conflicts and ambiguity, and routes unresolved cases into the existing batched human-review workflow.

## Product Decision

Use this sequence:

```text
live option snapshot
-> canonical normalization
-> controlled equivalence/keyword matching
-> token similarity candidate ranking
-> uniqueness, margin, conflict, and risk checks
-> deterministic selection OR typed human review
```

Important qualification:

- canonical and controlled-equivalence matches may be eligible for automatic execution when all safety conditions pass
- token similarity is candidate evidence, not universal authority to execute
- for Work Eligibility and other sensitive fields, token similarity alone must never authorize selection
- when uncertainty remains, ask the user rather than guess

The two non-negotiable outcomes remain:

```text
incorrect field entries = 0
final submission = false
```

## Current Architecture To Preserve

Trace and work with the active path rather than introducing a parallel system:

```text
apply CLI
-> AgentController
-> observe
-> field matching / deterministic resolution
-> planner
-> decision gate and field safety
-> action execution
-> verification
-> Runtime State
-> checkpoint review or final-submit stop
```

Relevant files currently include:

- `src/actions/selection-options.js`
- `src/actions/select.js`
- `src/agent/verifier.js`
- `src/reasoning/work-eligibility-resolution.js`
- `src/reasoning/field-matching.js`
- `src/review/review-checkpoint.js`
- `src/review/review-resolution.js`
- `src/agent/controller.js`
- focused tests beside those modules

The current custom-select implementation already handles:

- live ARIA option discovery
- searchable comboboxes using sequential typing
- exact and boundary-prefix matching
- selection context such as country for city disambiguation
- selected-state verification when the rendered label differs from the search value
- skipping unsupported optional selections
- excluding transient `listbox` and `option` nodes from field matching

Extend these behaviors. Do not replace them with a new browser protocol or matching framework.

## Scope And Delivery Boundaries

This is a medium-sized selection-pipeline change. Implement it as two independently testable commits. Do not combine both commits into one undifferentiated patch.

### Commit 1: Matcher Core

Implement only:

1. one small pure option-resolution module or an equivalently focused helper in the existing option-selection boundary
2. canonical normalization shared by native and custom option matching
3. narrowly controlled equivalence
4. bounded token similarity for Review candidate ranking only
5. explicit uniqueness, negation, and contradiction checks
6. native and custom controls consuming the same pure resolution result
7. focused matcher, native-select, and custom-combobox tests

Commit 1 must preserve existing checkpoint, artifact, and runtime-state behavior. Complete and validate Commit 1 before starting Commit 2.

### Commit 2: Runtime Integration And Evidence

Implement only after Commit 1 passes focused and MVP regression tests:

1. stable option-snapshot waiting for asynchronous comboboxes
2. typed Review fallback containing live options and the reason automatic matching was refused
3. sensitive-field execution policy integration
4. compact failure/artifact evidence for unresolved option matching
5. controller and replay coverage
6. guarded best-effort real-run validation

Do not add:

- Greenhouse-specific selectors or ATS branches
- a literal special case mapping only `Citizen or Permanent Resident Visa` to `Citizen or Permanent Resident`
- a large visa, degree, ATS, or field ontology
- embeddings, external APIs, or paid model calls
- a general fuzzy-matching dependency unless the repository already has one and it is demonstrably necessary
- automatic legal/privacy authorization
- token-similarity-based verification
- automatic final submission
- a configurable threshold matrix by field, control type, or ATS

## Matching Contract

Keep the matcher local and small. A result may use a compact shape such as:

```js
{
  status: "matched" | "needs-review" | "no-match",
  tier: "canonical" | "controlled-equivalence" | "token-similarity" | "none",
  optionLabel: "",
  candidates: [],
  reason: ""
}
```

This is a local helper result, not a new application-wide decision schema. Reuse existing review and execution contracts.

The matcher must only consider enabled, non-placeholder options observed from the current live control. It must never invent an option label.

## Stage 1: Canonical Normalization

Create one deterministic normalization function used by native and custom option matching.

It may normalize:

- case
- leading and trailing whitespace
- repeated internal whitespace
- Unicode normalization where supported by the existing runtime
- apostrophe variants
- punctuation used only as separators
- `&` versus `and`
- a leading article such as `the` when the remaining text is otherwise identical

It must preserve semantic evidence including:

- negation: `not`, `no`, `none`, `without`, `ineligible`
- numbers and units
- visa/status category words
- polarity such as `yes` and `no`

Canonical equality is the strongest automatic matching tier.

## Stage 2: Controlled Equivalence

Allow narrowly bounded equivalence rules that remove only low-information descriptors while preserving the substantive category.

For the verified Work Eligibility case, the resolver may recognize that a trailing generic descriptor such as `visa` can be omitted when:

1. the field has already been classified as Work Eligibility
2. the source is an explicit compatible `workAuthorization` profile fact
3. all substantive category tokens remain aligned, including `citizen`, `permanent`, and `resident`
4. there is no negation or conflicting status token
5. exactly one enabled live option satisfies the rule

Prefer a small field-policy hook or supplied match context over global removal of words such as `visa`. Do not make `visa`, `resident`, `citizen`, `work`, or `authorization` global stopwords.

Controlled equivalence may also retain existing safe structural rules, such as:

- exact expected text followed by a dial code
- exact city segment followed by region and country
- exact school name with only a leading `The`

Every rule must be explainable and covered by a positive and negative test.

## Stage 3: Controlled Keyword Matching

Keyword matching must be field-aware and polarity-aware.

For sensitive Work Eligibility options, keep the initial semantic representation limited to high-level dimensions derived only from an explicit profile fact:

```js
{
  citizen: true | false,
  permanentResident: true | false,
  temporaryWorkRights: true | false,
  sponsorshipRequired: true | false | null,
  negated: true | false
}
```

Do not attempt to model or classify every New Zealand visa type. Unknown or more specific categories remain unresolved and go to Review.

Requirements:

- derive required category anchors only from the explicit profile fact and the deterministic work-eligibility resolver
- require all required anchors in the candidate after canonicalization
- reject candidates containing conflicting anchors
- do not infer work authorization from location, nationality, employment history, or sponsorship preference
- do not infer sponsorship preference from visa type

Examples of conflicts that must prevent automatic selection:

```text
expected permanent resident
candidate temporary work visa

expected eligible/authorized
candidate not eligible/not authorized

expected citizen or permanent resident
candidate citizen only
```

The last example may be shown as a Review candidate, but must not be auto-selected merely because it shares tokens.

Controlled keyword matching is not a general execution tier in V1. It may prove a conflict or support a controlled-equivalence decision, but a keyword-only result must go to Review unless an existing, focused deterministic policy already establishes equivalence.

## Stage 4: Token Similarity

Use a transparent token metric such as weighted Jaccard, overlap coefficient, or another small deterministic calculation. Do not add opaque semantic scoring.

Requirements:

- calculate over canonical tokens
- retain negation, numbers, and category-bearing terms
- use a fixed, documented threshold
- require a fixed minimum margin between the top and second candidate
- reject ties and near-ties
- return the top candidates and scores for diagnostics and Review
- keep the candidate list bounded

Risk policy:

- token similarity is ranking and diagnostic evidence only in V1
- no field, including low-risk fields, may auto-select from token similarity in V1
- token similarity may rank bounded candidates for Review or feed the existing Codex semantic proposal path when available
- any later proposal to enable token-similarity execution must be supported by replay evidence and explicitly scoped to proven low-risk field intents

Do not tune thresholds solely to make the supplied example pass. The supplied example should pass through controlled equivalence, not generic fuzzy similarity.

Keep configuration intentionally small. At most use:

```text
TOKEN_SIMILARITY_THRESHOLD
TOKEN_SIMILARITY_MIN_MARGIN
MAX_REVIEW_CANDIDATES
OPTION_STABILITY_WINDOW_MS
```

Do not introduce separate thresholds for Work Eligibility, country, city, school, native selects, custom comboboxes, or individual ATS sites. Tier and risk policy, not field-specific score tuning, determine whether execution is allowed.

## Initial Execution Policy

| Match tier | Ordinary fields | Sensitive fields |
| --- | --- | --- |
| Canonical exact | Automatic | Automatic except legal/privacy consent |
| Controlled equivalence | Automatic when unique and conflict-free | Automatic only with explicit compatible source and focused deterministic policy |
| Controlled keyword only | Review by default | Review |
| Token similarity | Review | Review |
| Multiple or unstable candidates | Review | Review |
| Conflict detected | Reject | Reject |

For the supplied Work Eligibility case:

```text
tier = controlled-equivalence
source = explicit workAuthorization
unique stable candidate = Citizen or Permanent Resident
conflict = none
result = automatic selection permitted
```

## Uniqueness And Snapshot Completeness

Automatic execution requires exactly one surviving candidate across the complete current option snapshot.

For searchable or asynchronously populated comboboxes:

- do not decide uniqueness as soon as the first compatible option appears
- wait for a short bounded stability window after options appear
- require the option labels/count or snapshot identity to remain stable before matching
- retain the existing timeout and retry bounds
- if completeness or stability cannot be established, return Review rather than selecting

This corrects the current risk where `waitForSearchOptions` can return on the first compatible option before later competing options are rendered.

Disabled and placeholder options must never be selected or counted as valid candidates.

## Conflict Checks

Before automatic selection, reject the result if any of these apply:

- negation polarity differs
- yes/no polarity differs
- meaningful numeric values or units differ
- candidate contains a mutually exclusive legal/status category
- more than one candidate survives the current tier
- token-similarity margin is below the configured minimum
- option snapshot is incomplete or unstable
- source profile fact is missing or not compatible with the field intent
- decision gate or field-answer safety rejects the value

Keep conflict categories small and policy-aligned. Do not build a general legal ontology.

## Sensitive Field Execution Policy

Work Eligibility must continue to use only explicit profile facts.

Automatic selection is allowed only when all are true:

1. `work-eligibility-resolution` produced the proposal from explicit `workAuthorization`
2. field-answer safety approved the source/value relationship
3. the live option matcher reached canonical or controlled-equivalence tier
4. exactly one stable enabled option survived
5. no contradiction check fired
6. normal decision gate, execution, and verification still run

Otherwise create a typed option-selection Review item. Do not return a generic recovery error for a semantic option mismatch.

Consent, privacy, and declarations still require explicit current-statement authorization even if option text matches exactly.

## Review Behavior

When automatic matching is refused, the existing checkpoint should show:

- exact field label
- field type and sensitivity
- proposed profile-backed value, redacted where required
- live enabled options
- best bounded candidates
- concise refusal reason, such as `near-tie`, `conflicting-status`, `similarity-only-sensitive-field`, or `unstable-option-snapshot`

Example:

```text
Work Eligibility*
Proposed from explicit profile fact: Permanent Resident visa

Available options:
[1] Citizen or Permanent Resident
[2] Work Visa
[3] Not currently eligible to work

Agent assessment:
Option 1 is the closest compatible option, but user confirmation is required.
```

The CLI records the user's decision. Resume must re-observe the page, revalidate the selected option against the live control, execute through the normal decision gate/action/verifier path, and continue the same run.

Review answers remain `current-run` scoped and must not mutate the global profile.

## Optional Fields

Preserve the current behavior for low-risk optional selections:

- retry bounded transient loading once
- if no unique compatible option exists, clean up search text and close the popup
- record the field as skipped
- continue the application

Do not apply optional-skip behavior to required or sensitive unresolved fields.

## Verification

Verification must remain stricter than candidate matching.

- verify the exact option identity/label that was clicked using live selected-state evidence
- allow existing control-specific rendered-state evidence, such as a selected dial code, only when tied to the exact clicked option
- do not declare verification success from token similarity
- re-observe after selection and ensure the field is no longer unresolved
- never click a final submission control

## Artifact And Diagnostics

Keep the artifact compact, but replace generic `verification failed` evidence for option mismatches with enough information to debug:

- field label and control type
- match tier reached
- refusal reason
- number of enabled candidates
- bounded redacted candidate labels where allowed
- whether Review was created
- verification outcome

Follow existing redaction rules. Do not persist document contents or unnecessary sensitive raw profile values.

Do not add new top-level artifact taxonomies when existing `failures`, `manualInterventions`, and field records can carry the evidence additively.

## Tests

Add focused tests for the pure matcher and active controller path.

Required positive cases:

1. `Citizen or Permanent Resident Visa` -> `Citizen or Permanent Resident`
2. punctuation, apostrophe, whitespace, and case normalization
3. `and` versus `&` where otherwise identical
4. existing country plus dial-code behavior
5. existing city plus region/country disambiguation
6. existing school leading-article behavior
7. native select and custom searchable combobox use the same resolution result

Required rejection/Review cases:

1. `Citizen or Permanent Resident Visa` versus only `Citizen`
2. permanent resident versus temporary/work visa
3. authorized versus not authorized
4. yes versus no
5. same-token options with contradictory negation
6. equal top scores
7. insufficient score margin
8. multiple controlled-equivalence candidates
9. incomplete or changing asynchronous option snapshots
10. similarity-only result on a sensitive field
11. disabled candidate that would otherwise match
12. no observed option

Required workflow assertions:

- the verified Work Eligibility case selects `Citizen or Permanent Resident` exactly once
- the selected option is verified through live state
- a semantic mismatch becomes a pending typed checkpoint, not `recovery-needs-user-confirmation`
- optional unsupported selections are skipped and their popup/search state is cleaned up
- current-run Review decisions resume the same page
- no profile mutation occurs
- `finalSubmissionTriggered` and `submitted` remain false
- artifact evidence identifies the failed field and refusal reason

Add one lightweight replay case based on the supplied real-run failure. Do not store personal values beyond what the existing fixture/redaction conventions allow.

## Validation

### Required Code Validation

Run at minimum:

```bash
pnpm test:field-matching
pnpm test:controller
pnpm test:review-checkpoint
pnpm test:executor
pnpm test:apply-cli
pnpm benchmark:core
pnpm benchmark:replay
pnpm test:mvp
```

These code-level checks are the completion gate. Pure matcher tests, controller tests, replay coverage, and MVP regression must pass.

### Best-Effort Guarded Live Validation

After required code validation passes, attempt:

```bash
pnpm apply -- https://job-boards.greenhouse.io/released/jobs/7802196003
```

For the live run, verify and report:

- Country remains correctly selected and verified
- Location remains correctly selected and verified
- School remains correctly selected and verified
- unsupported optional Degree remains safely skipped unless a deterministic compatible mapping is separately justified
- Work Eligibility selects the exact observed option `Citizen or Permanent Resident`
- privacy/consent remains pending explicit user authorization
- salary remains pending explicit user input
- any required document issue is represented as Review, not a generic recovery failure
- the browser stops before final submission
- `finalSubmissionTriggered === false`
- `submitted === false`

Do not authorize the privacy statement, supply a salary answer, or submit the application during automated validation.

The live run is best-effort because the page, job availability, network, CAPTCHA, login state, and ATS frontend are external dependencies. If it cannot complete for an external reason:

- do not weaken tests or safety policy
- preserve the failure artifact where appropriate
- report the exact blocker and whether it is external or code-caused
- do not mark required code validation as failed solely because an external page is unavailable

## Implementation Sequence

### Commit 1

1. inventory current option matching and tests
2. add the pure canonical/controlled/token-ranking resolver
3. limit Work Eligibility semantics to the documented high-level dimensions
4. add uniqueness, negation, and conflict checks
5. integrate the same resolver with native and custom selection without changing browser capability contracts
6. add focused positive and rejection tests
7. run focused tests and `pnpm test:mvp`
8. inspect the diff before proceeding

### Commit 2

1. add stable-snapshot waiting for searchable comboboxes
2. route unresolved semantic matches into the existing checkpoint model
3. improve compact artifact evidence
4. add controller and replay coverage
5. run required focused tests, benchmarks, and `pnpm test:mvp`
6. attempt the guarded live run and classify any failure as code-caused or external

Do not clean unrelated deprecated code as part of this task. Report any newly discovered cleanup opportunities separately.

## Acceptance Criteria

The task is complete only when:

- no ATS-specific selector or one-off option pair was introduced
- both native and custom controls use the same deterministic option-resolution policy
- the supplied Work Eligibility case resolves through controlled equivalence
- token similarity cannot auto-select any field in V1
- negation and conflicting status cases cannot auto-select
- automatic selection requires one stable enabled candidate
- unresolved required/sensitive choices create a recoverable typed Review checkpoint
- optional unsupported choices still skip safely
- execution and verification remain separate from candidate matching
- current-run answers do not mutate the profile
- artifacts contain compact actionable failure evidence
- focused, replay, and full MVP tests pass
- privacy consent is not authorized automatically
- final submission is never triggered

Live-run success is not a hard acceptance criterion when an external dependency prevents validation. A live code-caused regression remains a defect and must not be mislabeled as external.

## Final Report

Report:

1. root cause confirmed from code and live evidence
2. matching tiers implemented and their exact execution policy
3. conflict and ambiguity safeguards
4. files changed
5. tests and benchmarks run with results
6. live-run outcome and artifact path
7. confirmation that privacy consent and final submission were not triggered
8. any residual cases intentionally left for human Review
