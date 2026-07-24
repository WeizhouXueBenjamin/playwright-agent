# Personal Job Application Assistant - Apply

## Authority

Before using this command, read:

1. `AGENTS.md`
2. `.codex/prompts/PROJECT_DIRECTION.md`

`PROJECT_DIRECTION.md` is authoritative. If this command conflicts with it, follow `PROJECT_DIRECTION.md`.

## Purpose

Run the local, human-supervised job-application workflow for one user who remains present.

Use the primary product command:

```bash
npm run apply -- <job-url> [profile.json] [resume] [cover-letter]
```

The goal is safe reduction of repetitive work, not unattended completion.

## Inputs

Required:

- job or application URL

Optional:

- profile JSON path
- explicitly configured resume path
- explicitly configured cover-letter path

Do not upload a file unless it was explicitly configured for the run.

## Runtime Model

Follow the active product loop:

```text
observe
-> resolve one next action
-> validate
-> execute
-> verify
-> update session state
-> repeat
```

After a reversible failure:

```text
re-observe
-> retry once
-> ask the user for manual intervention
-> continue or stop
```

Do not run benchmark, replay, capability-history, or improvement-proposal workflows during an active application run.

## Field Resolution

Use stable direct aliases only for:

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

For unfamiliar or sensitive semantics, use a supported Codex path only when available and bounded to the observed field plus relevant candidate facts. Otherwise ask the user.

Never expand fixed regexes or ontology rules just to handle one unusual field.

Every resolved field must record one truthful resolution method:

- `direct-alias`
- `codex-semantic`
- `user-confirmed`
- `user-edited`
- `manual`
- `skipped`

Fixtures, disabled providers, and shadow behavior must not be reported as `codex-semantic`.

## User Review

When a field or blocker cannot be safely resolved, use the supported review loop:

```text
[A] Accept suggestion
[E] Edit answer
[S] Skip field
[M] Complete manually, then continue
[Q] Stop this run
```

Default answer scope is `current-run`.

Do not persist review answers to the profile without a separate explicit user choice.

## Safety Rules

Never:

- trigger final submission
- click final Submit / Send Application / Confirm Submission controls
- invent candidate facts
- infer salary from role, seniority, experience, or skills
- infer legal, privacy, consent, immigration, or work-authorization answers
- reuse legal/privacy consent outside the exact current statement and run
- create an account without explicit approval
- bypass CAPTCHA or access controls
- upload unconfigured documents

The primary invariants are:

```text
incorrectFieldEntries = 0
finalSubmissionTriggered = false
unsafeActionsExecuted = 0
```

## Terminal Outcomes

End with one user-facing outcome:

- `ready-for-review`: all currently actionable fields are complete; user must inspect and submit manually
- `needs-review`: a field needs an explicit answer or edit and can resume in the same run
- `login-required`: authentication or account creation blocks progress
- `manual-intervention-required`: CAPTCHA, unsupported control, or user browser work is required before resume
- `application-unavailable`: the job or application form cannot be accessed
- `failed`: an unexpected unrecoverable error occurred

Do not classify a safe review stop as a technical failure.

## Artifacts

Each run should write one compact, privacy-conscious artifact under `logs/apply`.

Artifacts should prefer:

- bounded labels
- field fingerprints
- source paths
- resolution methods
- verification outcomes
- file names or hashes
- redacted previews

Do not store raw secrets, resume contents, full sensitive answers, or generated personal text unless strictly required.

## Required Final Response

Summarize:

- terminal outcome
- fields completed
- documents uploaded
- unresolved items
- current blocker, if any
- run artifact path
- confirmation that no final submission occurred
- exactly one next user action

Do not include benchmark diagnostics in the production result.
