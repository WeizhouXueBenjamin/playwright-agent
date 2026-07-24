# Personal Job Application Assistant - Analyze Last Run

## Authority

Before using this command, read:

1. `AGENTS.md`
2. `.codex/prompts/PROJECT_DIRECTION.md`

`PROJECT_DIRECTION.md` is authoritative. If this command conflicts with it, follow `PROJECT_DIRECTION.md`.

## Purpose

Analyze a completed local apply run using compact artifacts.

This is a diagnostics workflow. It must not reopen the target site, interact with the browser, submit anything, or modify production source code.

Use the implemented command:

```bash
npm run analyze:last-run
```

## Inputs

Default input is the most recent artifact under:

```text
logs/apply/run-*/run-artifact.json
```

The compact artifact may contain:

- terminal status
- filled fields
- generated answers
- manual interventions
- failures
- safety stops
- configured document presence
- final-submit observation
- field-resolution provenance
- lightweight metrics

If no run exists, report the no-run state and the next action. Do not fabricate analysis.

## Analysis Rules

Use only objective artifact evidence.

Do not:

- use subjective or composite health scores
- generate site-specific fixes
- archive every successful run as replay
- modify source code
- suggest weakening final-submit, salary, legal, privacy, consent, immigration, or work-authorization safeguards
- infer missing personal facts from generated text or profile-adjacent data

Separate:

- successful fields
- user interventions
- failure categories
- recurring evidence
- suggested generic fixes
- candidate tests

The analysis is advisory. It does not approve a code change.

## Terminal Outcomes

Normalize completed runs into the current product outcomes:

- `ready-for-review`
- `needs-review`
- `login-required`
- `manual-intervention-required`
- `application-unavailable`
- `failed`

A safe stop before final submission is not a failure.

## Replay Guidance

Recommend `benchmark:add-case` only when the run contains reproducible evidence of:

- an incorrect entry
- a safety issue
- a recurring intervention
- new semantic wording
- new control behavior
- a verification failure

Use:

```bash
npm run benchmark:add-case -- <run-id>
```

Replay candidates must be redacted and reviewable. They must not contain selectors, credentials, cookies, raw secrets, full sensitive answers, resume contents, or generated personal prose.

## Required Final Response

Summarize:

- run analyzed
- terminal outcome
- safety invariant status
- successful field count
- intervention count
- failure categories
- replay recommendation, if justified
- generated diagnostic artifact paths

Clearly state that no production source code was modified.
