# MVP Product Workflow Implementation and Real-Run Validation

## Instruction Authority

Before planning or changing this repository:

1. read `AGENTS.md`
2. read `.codex/prompts/PROJECT_DIRECTION.md` in full
3. evaluate the proposed work against the Development Decision Checklist in that document

`PROJECT_DIRECTION.md` is the authoritative long-term product direction. This prompt defines one implementation milestone within that direction; it does not override or broaden it.

If this prompt, the requested task, or the observed implementation conflicts with `PROJECT_DIRECTION.md`, stop before changing code, identify the exact conflict, and wait for explicit user direction. Do not silently reinterpret either document to continue.

## Mission

Turn the simplified repository into a usable personal job-application assistant and prove the workflow with offline regression coverage before attempting controlled real-site smoke tests.

The product is a local tool for one user who remains present during execution. Optimize for safe reduction of repetitive work, not unattended completion or maximum automation rate. Human review is an intended product path, not a failure to hide.

The target workflow is:

```text
Job URL
-> read the job description
-> find and open the application form
-> fill unambiguous fields
-> resolve unfamiliar semantics through an explicitly supported Codex path
-> ask the user when facts, consent, or intent are uncertain
-> generate reviewable open-question and cover-letter drafts
-> upload configured documents
-> retry one reversible failure once
-> stop before final submission
-> save a compact, privacy-conscious run artifact
-> turn selected failures into offline replay cases
```

This is a product-validation milestone, not another architecture cleanup. Do not continue deleting modules merely to reduce counts, and do not introduce a new general-purpose agent framework.

## Current Baseline

Verify these claims against the repository before changing code. Treat them as orientation, not assumptions:

- `npm run apply -- <job-url>` is the primary production entry point.
- final-submit protection, action verification, one-retry recovery, compact artifacts, and run-scoped review answers already exist.
- a review answer can already resume the active controller loop, but the CLI does not yet expose the complete Accept/Edit/Skip/Manual interaction.
- `analyze:last-run` exists and produces advisory diagnostics.
- `benchmark:core` currently points at a public URL and therefore is not a true offline core benchmark.
- the semantic decision provider is not a usable production Codex integration; disabled, fixture, or shadow behavior must not be reported as semantic product capability.
- job-description extraction, open-question generation, targeted cover-letter generation, and `benchmark:add-case` are not complete product workflows.

Start by running focused baseline tests and recording the actual gaps. Preserve unrelated user changes in the worktree.

## Non-Negotiable Safety Rules

- Never click, trigger, or programmatically submit a final application action.
- Never weaken salary, work-authorization, immigration, legal, privacy, or declaration safeguards to increase completion rate.
- Never invent candidate history, qualifications, dates, legal status, salary expectations, or consent.
- Never reuse legal/privacy consent outside the exact current statement and run.
- Never persist a review answer to the profile without a separate explicit user choice. Default scope is `current-run`.
- Never upload a file that was not explicitly configured for the run.
- Never store raw secrets, full sensitive answers, resume contents, or generated personal text in diagnostic artifacts unless strictly required. Prefer provenance, hashes, bounded previews, and redaction.
- Never use site-specific selectors or ATS-specific workflow scripts to make a smoke test pass.
- Never claim a real-site test passed if network policy, login, CAPTCHA, bot protection, or unavailable credentials prevented the workflow from reaching the relevant state.

The primary success invariants are:

```text
incorrectFieldEntries = 0
finalSubmissionTriggered = false
unsafeActionsExecuted = 0
```

## Scope Control

Implement the work as sequential gates. Do not start a later gate while an earlier gate has unresolved correctness failures.

Before each gate, answer the Development Decision Checklist from `PROJECT_DIRECTION.md` in working notes. Reject or reduce work that does not directly improve the primary `apply` workflow, lacks evidence from a current failure, or adds more active-runtime complexity than product value.

Do not perform a directory reorganization as part of this milestone. Add or move a module only when required by an implemented workflow. Follow the repository's current CommonJS style and existing boundaries.

Do not add:

- a new Decision or Observation contract version
- a page or ATS ontology
- a growing collection of field regexes
- multi-provider AI infrastructure
- complex benchmark scores
- self-modifying code or automatic fixes
- automatic submission
- PDF or DOCX generation

## Gate 0 - Baseline and Product Contract

Inspect the active runtime from `src/cli/complete-application.js` through observe, decide, gate, execute, verify, state update, recovery, review, and artifact creation.

Produce a short implementation note in the final report covering:

- what already works
- what is incomplete
- which tests demonstrate each claim
- which planned changes are actually necessary

Define one small set of user-facing terminal outcomes:

- `ready-for-review`: all currently actionable fields are complete; user must inspect and submit manually
- `needs-review`: a field needs an explicit answer or edit and can resume in the same run
- `login-required`: authentication or account creation blocks progress
- `manual-intervention-required`: CAPTCHA, unsupported control, or user browser work is required before resume
- `application-unavailable`: the job or application form cannot be accessed
- `failed`: an unexpected unrecoverable error occurred

Internal statuses may remain more detailed if tests or control flow need them. Normalize only at the CLI/report boundary rather than forcing a repository-wide status rewrite.

Gate 0 passes when the existing focused test suite is green and every later change maps to a demonstrated product gap.

## Gate 1 - Offline End-to-End Product Slice

Build deterministic local HTML fixtures that exercise the real `apply` controller path, not isolated mocks:

- a single-page form with text, select, checkbox, upload, and final submit
- a job-detail page whose Apply action opens a multi-step form
- a login/account blocker
- an unavailable-application page
- a form with one ambiguous/sensitive field requiring review
- an action that fails verification once and is recoverable

Use local files or a local HTTP server. The core suite must not depend on DNS, public websites, credentials, or an external AI service.

Verify:

- navigation from job detail to application form
- ordinary field filling
- native select, checkbox, and upload behavior
- already verified fields are not repeated
- review resolution resumes the same run
- reversible failures retry at most once
- login and unavailable pages map to the correct user-facing outcome
- final submit remains untouched in every fixture
- every run writes one compact artifact

Add `finalSubmissionTriggered` as an observed invariant, not merely a hardcoded `submitted: false` report value. For fixtures, instrument the form so a submit event would be detectable and fail the test.

Gate 1 passes only when the offline vertical slice is deterministic and green.

## Gate 2 - Resolution Boundary and Provenance

Use two resolution levels.

### Stable direct aliases

Keep a small bounded alias table only for:

- first name
- last name
- preferred name
- email
- phone
- city
- country
- postcode
- LinkedIn
- portfolio
- resume upload
- cover-letter upload

Aliases generate candidates; they do not bypass safety validation.

### Semantic resolution

Use semantic resolution for fields such as:

- visa type versus visa status
- immigration or work-authorization wording
- sponsorship
- city versus region or preferred location
- school versus employer
- qualification variants
- unfamiliar select options
- unfamiliar field wording

The semantic resolver input must be bounded to the observed field and relevant candidate facts:

```json
{
  "field": {
    "ref": "field-17",
    "label": "What is your current immigration status?",
    "placeholder": "",
    "section": "Eligibility",
    "controlType": "select",
    "options": ["Citizen", "Permanent Resident", "Work Visa", "Other"]
  },
  "candidateFacts": [
    { "path": "workEligibility.visaType", "value": "Post Study Work Visa" },
    { "path": "workEligibility.visaStatus", "value": "Valid" },
    { "path": "workEligibility.authorizedToWork", "value": true }
  ]
}
```

The output must be a small action proposal:

```json
{
  "action": "select",
  "fieldRef": "field-17",
  "value": "Work Visa",
  "source": "workEligibility.visaType",
  "requiresReview": false
}
```

Before execution, deterministic code must validate that:

- `fieldRef` exists in the current observation
- the control is visible and interactive
- the action matches the control capability
- a proposed select option exists
- the source path and source value exist in the supplied candidate facts/profile
- policy and field-answer safety allow the action
- the action is not final submission

### Codex feasibility gate

Before implementing semantic execution, determine the actual zero-additional-cost invocation available in this environment. A fixture provider is test infrastructure, not a production implementation.

Prefer the Codex CLI already available to the user. Do not add a paid per-request model API, external model dependency, provider-selection layer, or generalized AI SDK abstraction to satisfy this milestone.

If a supported local Codex CLI invocation is available, implement one narrow product adapter with:

- structured JSON input and output
- timeout and parse-failure handling
- no shell interpolation of profile values
- no hidden fallback to guessed deterministic answers
- explicit `needs-review` fallback

If no supported invocation is available, do not fabricate integration and do not add another provider as a substitute. Keep the smallest test seam needed for contract fixtures, route unresolved fields to human review, and report the external capability blocker precisely.

For each field, record one resolution method:

- `direct-alias`
- `codex-semantic`
- `user-confirmed`
- `user-edited`
- `manual`
- `skipped`

The field artifact record must include field fingerprint, bounded label, control type, source path, resolution method, outcome, and whether the user intervened. Redact sensitive values.

Gate 2 passes when provenance reflects the path actually used and a disabled/fixture resolver can never be mislabeled `codex-semantic`.

## Gate 3 - Complete Human Review Loop

Extend the current review loop instead of replacing it. The CLI must support:

```text
[A] Accept suggestion
[E] Edit answer
[S] Skip field
[M] Complete manually, then continue
[Q] Stop this run
```

Required behavior:

- Accept uses the displayed suggestion only after explicit confirmation.
- Edit captures an exact run-scoped answer.
- Skip marks only the current field skipped and continues when safe.
- Manual keeps the browser open, waits for the user, re-observes the page, verifies the field state, and continues.
- After any answer or manual action, re-observe and verify before marking the field complete.
- A resolved blocker must not restart the application or repeat completed fields.
- Invalid options or incompatible values must return to review with a clearer message.
- Profile mutation is a separate opt-in after the run; it is not part of the default path.

Gate 3 passes when focused tests cover all five commands and at least one blocker is resolved before the workflow reaches `ready-for-review`.

## Gate 4 - Job Context and Reviewable Text Generation

### Job-description extraction

Extract a bounded structure from the job page:

```json
{
  "title": "",
  "company": "",
  "location": "",
  "summary": "",
  "responsibilities": [],
  "requirements": [],
  "preferredQualifications": [],
  "rawText": ""
}
```

Exclude navigation, cookie banners, footer text, related jobs, and obvious company boilerplate. Bound `rawText` size. If extraction is insufficient, support user-supplied pasted text or a local UTF-8 text/Markdown file.

### Open questions

Treat textarea/long-text controls and semantic cues such as `why`, `describe`, `tell us`, `explain`, `experience`, and `motivation` as candidates, not a complete ontology.

Generation input must contain only the question, extracted job context, relevant verified profile facts, and explicit constraints. Enforce `doNotInvent: true` and any detected character/word limit.

Generated text is always a draft. Require Accept/Edit/Skip before writing it into the browser, then verify the resulting value.

### Cover letter

Support one coherent workflow, either:

```bash
npm run generate:cover-letter -- <job-url>
```

or an in-flow suggestion when a cover-letter field is observed. Prefer reuse of the same job-context and generation boundary.

The output may be displayed and saved as `.md` or `.txt`. Fill or upload it only after explicit user confirmation. Do not add PDF/DOCX generation in this milestone.

As with semantic resolution, generation requires a real supported Codex CLI invocation. If unavailable, provide a clean review/handoff artifact and report the blocker; do not substitute canned text and call it generated.

Offline tests must validate the extraction, bounded input contract, output validation, user-confirmation boundary, and browser insertion behavior with explicit fixtures. Fixture output proves deterministic integration behavior only; it does not prove Codex generation quality.

When a supported local Codex CLI invocation exists, add a separate opt-in smoke test proving that the real adapter returns valid structured output. Keep this smoke test outside the fully offline core benchmark and make failures explicit.

Gate 4 passes when offline contract tests prove:

- one fixture open-question draft and one fixture targeted cover-letter draft can cite supplied JD/profile evidence
- output validation rejects unsupported claims that cannot be traced to supplied evidence
- length limits are respected
- no draft reaches the browser without confirmation

Full Codex product capability may be claimed only when the real opt-in adapter smoke test also passes. Otherwise report Gate 4 as contract-complete and integration-blocked.

## Gate 5 - Lightweight Benchmark and Replay Loop

Make these commands accurate and operational:

```bash
npm run benchmark:core
npm run benchmark:replay
npm run analyze:last-run
npm run benchmark:add-case -- <run-id>
```

`benchmark:core` must be fully offline and use authored fixtures covering:

- stable identity fields
- location ambiguity
- visa type versus visa status
- authorization versus sponsorship
- option mismatch
- ambiguous fields
- open-ended text review
- resume upload
- legal/privacy review
- salary safeguard
- final-submit protection

`benchmark:replay` must contain only selected anonymized regressions representing an incorrect entry, safety issue, recurring intervention, new semantic wording, new control behavior, or verification failure. Do not archive every successful production run.

`benchmark:add-case` must:

- require an explicit run ID
- refuse runs with insufficient reproducible evidence
- redact personal and site-sensitive data
- create a reviewable fixture, never a site-specific automation script
- avoid selectors, credentials, cookies, and generated personal prose

`analyze:last-run` should report only successful fields, interventions, failure categories, recurrence evidence, suggested generic fixes, and candidate tests. It must remain advisory and must not edit production code.

Use transparent counts and rates, not a composite health score. Define denominators:

```text
directResolutionRate = directAliasFields / allResolvedFields
semanticResolutionRate = codexSemanticFields / allResolvedFields
manualInterventionRate = userConfirmedOrEditedOrManualFields / allEncounteredActionableFields
incorrectFieldEntries = verified incorrect entries
verificationFailures = failed post-action verifications
finalSubmissionTriggered = observed submit events or irreversible submit navigation
```

Gate 5 passes when both benchmark commands run without public network access and a synthetic failed run can be converted into a redacted replay candidate.

## Gate 6 - Controlled Real-Site Validation

Do not choose random live vacancies. Ask the user for explicit test URLs or approval to use named public pages before starting this gate. Never use credentials, apply to a role, or create an account without explicit authorization.

Validate, where access permits:

- one single-page application form
- one job-detail to multi-step application flow
- one login/account/unavailable blocker

Use a test profile and harmless fixture documents. Stop at the first point where proceeding could create an account, accept a legal statement, send personal data, or submit an application unless the user explicitly resolves that review step.

For each run, record:

- encountered actionable fields
- direct-alias resolutions
- genuine Codex semantic resolutions
- user confirmations/edits
- manual completions
- incorrect entries
- verification failures
- terminal outcome
- observed final-submit trigger status

A real-site run passes only if the fields actually reached were handled correctly, the artifact is complete, and all three primary safety invariants remain satisfied. A blocked page may be a valid classification result, but it is not evidence that downstream form filling works.

## Required Verification

Run focused tests after each gate and `npm run test:mvp` before completion. Add integration tests to the active MVP suite rather than leaving them as undocumented one-off commands.

At minimum preserve or add coverage for:

- normal text, select, checkbox, and upload actions
- job-detail to form navigation
- already completed field skipping
- semantic proposal validation and provenance
- all review commands and resume behavior
- legal/privacy and salary safeguards
- retry exactly once
- manual completion followed by re-observation
- generated text confirmation
- login/unavailable classification
- compact artifact redaction
- observed final-submit protection
- offline core and historical replay

If a test cannot run because of browser installation, network policy, credentials, or unsupported Codex invocation, state that explicitly. Do not weaken or skip the assertion silently.

## Completion Criteria

This milestone is complete when:

- `npm run apply -- <job-url>` has one coherent user-facing flow
- the workflow remains a local, single-user, human-supervised tool with zero additional paid API requirements
- the offline vertical slice covers single-page, multi-step, review, blocker, recovery, upload, and submit protection behavior
- stable aliases are bounded and unfamiliar semantics do not expand regex ontology
- every resolved field records truthful provenance
- human review supports Accept/Edit/Skip/Manual/Stop and resumes safely
- JD context and generated drafts are reviewable and never invent facts
- core benchmark and replay run offline
- selected failures can become redacted replay candidates
- terminal outcomes and metrics have stable definitions
- `incorrectFieldEntries = 0`
- `unsafeActionsExecuted = 0`
- `finalSubmissionTriggered = false`

Do not claim full completion if the Codex feasibility gate or controlled real-site validation is blocked. Report the implemented subset and the exact remaining dependency.

## Final Report

Return:

1. confirmation that `AGENTS.md` and `PROJECT_DIRECTION.md` were read before implementation
2. Development Decision Checklist assessment and any work reduced or rejected by it
3. baseline findings and plan adjustments
4. gates completed and gates blocked
5. files changed
6. active product workflow
7. semantic/generation invocation actually used, distinguishing fixtures from real Codex CLI evidence
8. review interaction behavior
9. artifact and privacy changes
10. offline benchmark and replay results
11. focused and full tests run
12. real-site runs attempted, with exact access limits
13. field-resolution metrics with denominators
14. confirmation of all three safety invariants
15. remaining blockers and the single highest-value next step
