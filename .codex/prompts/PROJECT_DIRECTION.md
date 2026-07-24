# Personal Job Application Assistant — Product Definition and Development Alignment

## Purpose

Use this document as the permanent product-alignment prompt for all future planning, implementation, refactoring, debugging, benchmarking, and review work on this repository.

Every proposed change should be evaluated against this product definition before implementation.

---

# Product Definition

This project is a local, personal job-application assistant.

It is designed for one user who is present during execution.

Its purpose is to reduce repetitive work when completing online job applications while preserving human control over uncertain, sensitive, or irreversible decisions.

The product should:

- accept a job or application URL
- open and inspect the page
- locate the application flow
- automatically fill clear, low-risk fields from a local profile
- handle simple variations of equivalent field meanings
- use Codex for semantic interpretation and targeted text generation where fixed mappings are insufficient
- ask the user when information is missing, ambiguous, sensitive, or unsafe to infer
- generate a targeted cover letter from the job description and profile
- generate factual answers to open-ended application questions
- upload only explicitly configured documents
- verify browser actions
- stop before final submission
- save a compact run artifact
- learn from selected real-run failures through lightweight benchmark replay and advisory improvement proposals

The goal is not full unattended automation.

The goal is safe, useful automation with human review where necessary.

---

# Primary User Workflow

The intended workflow is:

```text
User provides job URL
-> application page is opened
-> job description is captured
-> visible application fields are observed
-> clear fields are filled from profile
-> unfamiliar or ambiguous fields are interpreted using context
-> user is asked when a safe answer cannot be determined
-> open-ended answers are generated and reviewed
-> a targeted cover letter is generated when needed
-> configured documents are uploaded
-> every action is verified
-> the workflow stops before final submission
-> a concise run summary and artifact are produced
```

The primary command should remain simple:

```bash
npm run apply -- <job-url>
```

---

# Product Constraints

## Zero Additional API Cost

The primary workflow should not require paid per-request model APIs.

Prefer:

- Codex CLI already available to the user
- local Node.js code
- Playwright CLI or the existing lightweight Playwright layer
- local profile and document files
- console-based human review

External model providers may be explored later, but must not become a requirement for the core product without explicit approval.

## Personal Local Tool

This is not currently intended to be:

- a multi-user SaaS
- a public autonomous application bot
- a multi-provider AI platform
- a general-purpose browser-agent framework
- a research benchmark platform
- an ATS ontology engine
- a self-modifying production system

Do not introduce architecture primarily justified by those future possibilities.

## Human in the Loop

When the system is uncertain:

```text
ask the user
>
guess
```

The user should be able to:

- accept a suggestion
- edit a suggestion
- skip a field
- complete a field manually
- resume execution afterward

User-supplied answers should be run-scoped by default.

Permanent profile updates should require explicit confirmation.

---

# Responsibility Boundary

## Deterministic Code Should Own

- browser launch and navigation
- page observation
- visible field extraction
- stable field aliases
- browser actions
- option existence checks
- file-path validation
- action verification
- completed-field tracking
- retry limits
- final-submit protection
- salary, legal, privacy, and consent safeguards
- compact run artifacts
- lightweight benchmark replay
- recurring issue aggregation

## Codex Should Own

- interpreting unfamiliar field wording
- selecting among supplied candidate profile facts
- distinguishing related concepts such as visa type and visa status
- mapping an explicit profile fact to an available option
- understanding the job description
- generating a targeted cover letter
- generating factual open-ended answers
- explaining uncertainty
- proposing user-review questions

Codex should not:

- invent selectors
- execute arbitrary JavaScript
- bypass final-submit protection
- fabricate profile facts
- infer unsupported legal or financial information
- silently accept declarations
- automatically modify production code from run diagnostics

---

# Field Resolution Strategy

Use two levels.

## Level 1 — Stable Direct Mapping

Use small, intentionally limited alias groups for predictable fields:

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
- resume
- cover letter

Do not keep expanding aliases for every unusual phrase.

## Level 2 — Semantic Resolution

Use Codex or user review for unstable or context-dependent fields such as:

- visa type
- visa status
- immigration status
- work authorization
- sponsorship
- current location vs preferred location
- city vs region
- school vs employer
- qualification variations
- unfamiliar select options
- open-ended questions

Provide:

- field label
- placeholder
- nearby text
- section heading
- control type
- available options
- relevant profile facts
- current job context

Codex should return a simple action proposal.

Example:

```json
{
  "action": "select",
  "fieldRef": "field-17",
  "value": "Work Visa",
  "source": "workEligibility.visaType",
  "reason": "The field asks for immigration category and the option is compatible with the explicit profile fact.",
  "requiresReview": false
}
```

Code must verify:

- the field exists
- the source fact exists
- the option exists
- the action is supported
- the action is not irreversible

---

# Sensitive-Field Rules

Keep these safeguards small and explicit.

## Salary

- never substitute role titles, summaries, skills, or experience
- only use an explicit compatible salary expectation
- otherwise ask the user or leave the field unresolved

## Work Eligibility

- do not infer work authorization from sponsorship preference
- do not infer sponsorship preference from visa type
- do not infer legal status from location, nationality, or employment history
- use only explicit profile facts
- request review when wording or scope is ambiguous

## Privacy, Consent, and Declarations

- never auto-confirm by default
- require explicit user confirmation for the current statement

## Final Submission

- never click or activate a final submission action
- stop at `ready-for-review`

These rules must remain deterministic and must not depend only on prompt compliance.

---

# Job Description and Text Generation

## Job Description

Capture a bounded representation containing:

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

Exclude unrelated navigation, footer, cookie, and marketing content where practical.

Allow manual JD input when extraction is insufficient.

## Open-Ended Questions

Generate answers from:

- the exact question
- job description
- relevant profile facts
- CV-supported achievements
- word limit
- tone constraints

Requirements:

- do not invent experience
- preserve factual metrics
- use simple, direct, professional language
- require user review before filling by default

## Cover Letter

Generate a targeted cover letter from:

- job description
- profile
- CV-supported experience
- configurable writing prompt
- word limit and tone

Requirements:

- mirror relevant job terminology naturally
- avoid keyword stuffing
- avoid generic praise
- preserve the user’s writing style
- output to console
- optionally save as `.txt` or `.md`
- require review before insertion

PDF or DOCX generation is not required for the MVP.

---

# Browser Execution Model

The active runtime should remain simple:

```text
observe
-> resolve one next action
-> validate
-> execute
-> verify
-> update session state
-> repeat
```

After failure:

```text
re-observe
-> retry once
-> ask user for manual intervention
-> continue or stop
```

Do not rebuild a complex autonomous recovery framework.

The internal action proposal should remain lightweight:

```js
{
  action: "fill | select | check | upload | click | ask-user | generate-text | stop",
  fieldRef: "field-12",
  value: "Wellington",
  source: "personal.city",
  reason: "The field requests the current city.",
  requiresReview: false
}
```

Do not allow this contract to grow back into a large general-purpose agent protocol without a demonstrated product need.

---

# Runtime State

Store only facts required for the current session:

```js
{
  url,
  completedFields,
  skippedFields,
  manualReview,
  recentActions,
  validationFacts,
  status
}
```

Do not store speculative reasoning as verified state.

Do not reintroduce large decision-provenance or recovery taxonomies into the active runtime unless a concrete product problem requires them.

---

# Run Artifacts and Iterative Improvement

Each run should save a compact local artifact:

```json
{
  "runId": "run-...",
  "url": "",
  "status": "ready-for-review",
  "filledFields": [],
  "generatedAnswers": [],
  "manualInterventions": [],
  "failures": [],
  "safetyStops": [],
  "submitted": false
}
```

Each field record should include:

- observed label
- control type
- available options
- selected answer
- source profile path
- resolution method
- verification outcome
- user intervention status

Allowed resolution methods:

- `direct-alias`
- `codex-semantic`
- `user-confirmed`
- `user-edited`
- `manual`
- `skipped`

---

# Lightweight Benchmark and Self-Improvement

Retain a small, practical improvement loop:

```text
real run
-> compact artifact
-> issue classification
-> recurring issue aggregation
-> advisory improvement proposal
-> developer approval
-> regression replay
```

Recommended commands:

```bash
npm run analyze:last-run
npm run benchmark:core
npm run benchmark:replay
npm run benchmark:add-case -- <run-id>
```

## Core Benchmark

Keep a small offline authored suite covering:

- stable identity fields
- location
- visa type vs visa status
- work authorization vs sponsorship
- upload
- open-ended questions
- legal/privacy review
- salary safeguard
- final-submit protection

## Historical Replay

Add a real-run case only when it represents:

- a previously incorrect answer
- a safety failure
- a recurring semantic issue
- a new field variation
- a new browser control behavior
- a meaningful verification failure

Do not make every run a permanent fixture.

## Improvement Proposals

Proposals must be advisory only.

They may include:

- evidence
- root cause
- generic improvement
- candidate tests
- risk
- status

The system must not automatically edit production code.

A developer must explicitly:

- accept
- edit
- reject
- defer

---

# Architecture Guardrails

Do not introduce or rebuild:

- multiple active observation schemas
- multiple active decision schemas
- shadow AI infrastructure
- multi-provider abstractions
- large page-intent ontologies
- large field-intent ontologies
- ATS-specific selectors
- page/task/benchmark composite health scores
- full post-mortems for routine successful runs
- autonomous code modification
- autonomous final submission
- unrestricted browser-code generation

Patterns should support candidate generation, not become the final source of semantic truth for unstable fields.

---

# Product Success Metrics

Prioritize:

1. incorrect field entries
2. final-submit violations
3. successful completion to review stage
4. manual intervention rate
5. verified field completion
6. action failures
7. recurring issue reduction
8. usefulness of generated answers

The two non-negotiable outcomes are:

```text
incorrect field entries = 0
final submission = false
```

Do not optimize automation rate at the expense of correctness.

Do not use one opaque health score as the primary product metric.

---

# Development Decision Checklist

Before implementing any change, answer:

1. Does this directly improve the personal application workflow?
2. Does it reduce repetitive user work?
3. Does it preserve human control?
4. Can the problem be solved with a smaller change?
5. Is this adding a new framework, taxonomy, schema, or abstraction?
6. Is that abstraction required by a current real-world failure?
7. Could Codex or user review handle this instead of another fixed rule?
8. Does the change preserve final-submit protection?
9. Does it preserve factual and legal safety?
10. Can the improvement be covered by a core or replay benchmark?
11. Does it increase active runtime complexity?
12. If so, is the product benefit clearly larger than the maintenance cost?

Reject or defer changes that do not pass this check.

---

# Definition of Done for New Features

A feature is complete only when:

- it works through the primary `apply` workflow
- it does not require an additional paid API
- it has a clear console interaction
- it preserves final-submit protection
- it preserves sensitive-field safeguards
- it records its outcome in the run artifact
- it has focused tests
- it has at least one relevant core or replay case
- it does not introduce unnecessary platform architecture
- documentation reflects the active workflow

---

# Final Product Positioning

This project should remain:

> A lightweight, local, human-supervised job-application assistant that automates repetitive fields, uses Codex for context-sensitive interpretation and writing, asks the user when uncertain, stops before submission, and improves through compact real-run diagnostics and replay tests.

It should not drift back into:

> A general-purpose autonomous browser-agent platform with large semantic ontologies, multiple provider layers, research-grade metrics, or unattended irreversible actions.
