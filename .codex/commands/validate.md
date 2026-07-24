# Personal Job Application Assistant - Validate

## Authority

Before using this command, read:

1. `AGENTS.md`
2. `.codex/prompts/PROJECT_DIRECTION.md`

`PROJECT_DIRECTION.md` is authoritative. If this command conflicts with it, follow `PROJECT_DIRECTION.md`.

## Purpose

Validate the local product workflow with offline regression coverage and selected redacted replay cases.

This command is for validation, not for active job applications and not for live-site exploration.

Use the implemented commands:

```bash
npm run test:mvp
npm run benchmark:core
npm run benchmark:replay
```

Use replay-case creation only when justified by a completed run artifact:

```bash
npm run benchmark:add-case -- <run-id>
```

## Scope

Validation must remain aligned with the current product:

- local single-user tool
- human present during execution
- no automatic final submission
- no paid per-request model API requirement
- no new general-purpose browser-agent framework
- no ATS-specific selectors or workflow scripts
- no composite health score as the primary signal

## Offline Core Benchmark

`npm run benchmark:core` must use authored local fixtures only.

It should cover practical workflow behavior such as:

- stable identity fields
- select, checkbox, and upload actions
- job-detail or navigation to form where available
- review-required fields
- login blocker
- unavailable application
- salary/legal/privacy safeguards
- final-submit protection

Do not point the default core benchmark at a public URL.

## Replay Benchmark

`npm run benchmark:replay` must use selected anonymized replay cases only.

Add a replay case only when a run represents:

- an incorrect entry
- a safety issue
- a recurring intervention
- new semantic wording
- new control behavior
- a verification failure

Do not archive every successful production run.

Replay cases must be redacted and reviewable. They must not include:

- selectors
- credentials
- cookies
- raw secrets
- full sensitive answers
- resume contents
- generated personal prose

## Metrics

Use transparent counts and rates, with clear denominators:

- `directResolutionRate = directAliasFields / allResolvedFields`
- `semanticResolutionRate = codexSemanticFields / allResolvedFields`
- `manualInterventionRate = userConfirmedOrEditedOrManualFields / allEncounteredActionableFields`
- `incorrectFieldEntries = verified incorrect entries`
- `verificationFailures = failed post-action verifications`
- `finalSubmissionTriggered = observed submit events or irreversible submit navigation`

Do not use one opaque health score as the primary product metric.

## Safety Checks

Every validation run must confirm:

```text
incorrectFieldEntries = 0
finalSubmissionTriggered = false
unsafeActionsExecuted = 0
```

Do not weaken salary, work-authorization, immigration, legal, privacy, declaration, upload, or final-submit safeguards to make validation pass.

## Codex Semantic / Generation Claims

Fixture providers prove contract behavior only.

Claim real Codex semantic or generation capability only when a supported local Codex CLI adapter smoke test has passed. If unavailable or failing, report the capability as integration-blocked and ensure unresolved fields route to user review.

## Required Final Response

Summarize:

- commands run
- core benchmark result
- replay benchmark result
- focused test result
- safety invariant status
- any blocked Codex semantic/generation capability
- any replay candidate created
- highest-value next validation gap

Clearly state that validation did not submit an application, create an account, or modify production source code.
