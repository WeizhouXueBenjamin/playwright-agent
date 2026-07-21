# Personal Job Application Assistant — Zero Additional API Cost MVP

## Context

The project has been simplified from a general Browser AI Agent platform into a personal job-application assistant.

The product is intended for one user operating it locally.

The goal is not full unattended automation.

The goal is:

- provide a job URL
- automatically fill clear application fields
- recognize simple field variations
- ask for human help when uncertain
- use Codex for semantic decisions and text generation
- generate a targeted cover letter from the job description and profile
- generate answers for open-ended questions
- stop before final submission
- avoid additional paid API usage
- preserve a lightweight benchmark and run-driven iterative-improvement workflow

Use Codex CLI as the semantic reasoning and text-generation environment where practical.

Use Playwright CLI or the existing simplified Playwright layer for browser observation and execution.

---

# Product Goal

The desired workflow is:

```text
User provides job URL
-> browser opens page
-> application page is located
-> visible fields are inspected
-> obvious fields are filled from profile
-> ambiguous fields are classified using field context
-> user is asked when information is missing
-> Codex generates open-text answers when required
-> cover letter is generated from JD + profile
-> application is completed as far as safely possible
-> automation stops before final submission
-> console prints a review summary
-> compact run artifact is saved
-> recurring issues can be analyzed and replayed
```

---

# Core Principles

## Zero Additional API Cost

Do not require a paid API provider for the primary workflow.

Prefer:

- Codex CLI already available to the user
- local Node.js code
- Playwright CLI
- local profile files
- console interaction

Keep external AI provider integration out of the MVP runtime.

## Human in the Loop

The user is expected to be present.

When uncertain:

```text
ask the user
>
guess
```

## Simple Before General

Do not build:

- a universal ATS ontology
- a large field-intent framework
- a multi-provider agent platform
- a self-modifying system
- a complex autonomous recovery engine

## Safety

Never:

- click the final Submit button
- accept legal/privacy declarations without confirmation
- invent salary information
- invent work eligibility
- fabricate experience
- upload files outside configured paths

## Iterative Improvement

Preserve:

- compact run artifacts
- automatic issue classification
- recurring issue aggregation
- advisory improvement proposals
- core regression fixtures
- replay of selected historical failures

Do not automatically modify production source code.

---

# Phase 1 — CLI Workflow

Provide one primary command:

```bash
npm run apply -- <job-url>
```

Optional flags may include:

```bash
npm run apply -- <job-url> --headed
npm run apply -- <job-url> --profile ./profile.json
npm run apply -- <job-url> --resume ./documents/resume.pdf
```

The workflow should:

1. validate inputs
2. load profile
3. launch or connect to browser
4. open the URL
5. inspect the page
6. find the application flow
7. fill fields
8. pause for user review when needed
9. stop before final submission
10. print a summary
11. save a compact run artifact

---

# Phase 2 — Simplified Profile

Use one structured profile file.

Recommended shape:

```json
{
  "personal": {
    "firstName": "Benjamin",
    "lastName": "Xue",
    "preferredName": "Benjamin",
    "email": "",
    "phone": "",
    "city": "Wellington",
    "region": "Wellington",
    "country": "New Zealand",
    "postcode": "",
    "linkedin": "",
    "portfolio": ""
  },
  "workEligibility": {
    "country": "New Zealand",
    "authorizedToWork": true,
    "requiresSponsorship": false,
    "visaType": "Post Study Work Visa",
    "visaStatus": "Valid",
    "details": ""
  },
  "education": [],
  "experience": [],
  "skills": [],
  "career": {
    "targetRoles": [],
    "summary": ""
  },
  "documents": {
    "resume": "",
    "defaultCoverLetter": ""
  },
  "preferences": {
    "salaryExpectation": null,
    "referralSource": null
  }
}
```

Do not infer missing legal or financial facts.

---

# Phase 3 — Field Observation

For each visible form field collect:

```js
{
  ref,
  label,
  labelCandidates,
  placeholder,
  nearbyText,
  sectionHeading,
  controlType,
  inputType,
  options,
  required,
  currentValue,
  disabled
}
```

Do not send raw full-page HTML unless necessary.

Use current-page references rather than exposing selectors to Codex.

---

# Phase 4 — Two-Level Field Resolution

## Level 1 — Stable Direct Mapping

Use small alias groups for predictable fields:

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

Example aliases:

```js
{
  firstName: ["first name", "given name", "forename"],
  lastName: ["last name", "surname", "family name"],
  email: ["email", "email address"],
  phone: ["phone", "mobile", "contact number"],
  city: ["city", "current city"],
  country: ["country", "current country"]
}
```

Do not keep expanding aliases for every unusual phrase.

## Level 2 — Semantic Resolution

Use Codex or console-assisted reasoning for fields such as:

- visa type
- visa status
- work authorization
- sponsorship
- current immigration status
- preferred work location
- school vs employer
- qualification variations
- custom select options
- unfamiliar field wording

Provide Codex with:

```json
{
  "field": {
    "ref": "field-17",
    "label": "What is your current immigration status?",
    "placeholder": "",
    "nearbyText": "",
    "sectionHeading": "Eligibility",
    "controlType": "select",
    "options": [
      "Citizen",
      "Permanent Resident",
      "Work Visa",
      "Student Visa",
      "Other"
    ]
  },
  "candidateFacts": [
    {
      "path": "workEligibility.visaType",
      "value": "Post Study Work Visa"
    },
    {
      "path": "workEligibility.visaStatus",
      "value": "Valid"
    },
    {
      "path": "workEligibility.authorizedToWork",
      "value": true
    }
  ]
}
```

Expected result:

```json
{
  "action": "select",
  "fieldRef": "field-17",
  "value": "Work Visa",
  "source": "workEligibility.visaType",
  "reason": "The field asks for immigration category, and Work Visa is the compatible available option.",
  "requiresReview": false
}
```

Code must verify:

- field reference exists
- option exists
- field is enabled
- action is not final submission

When uncertainty remains, request user review.

---

# Phase 5 — Human Review

Provide a console interaction for unresolved fields.

Example:

```text
Review required

Field:
Are you legally authorized to work in New Zealand?

Suggested answer:
Yes

Source:
profile.workEligibility.authorizedToWork

Reason:
The profile contains an explicit country-scoped authorization value.

Choose:
[Y] Accept
[E] Edit
[S] Skip
[M] Complete manually
```

For missing information:

```text
No safe answer is available.

Please enter an answer, skip the field, or complete it manually.
```

After manual completion, allow the user to press Enter to re-observe and continue.

---

# Phase 6 — Open-Ended Question Generation

Detect textarea or long-text questions that are not ordinary address/profile fields.

Examples:

- Why are you interested in this role?
- Tell us about your relevant experience.
- Why do you want to work here?
- Describe a difficult technical problem you solved.
- What makes you suitable for this position?

Build a generation context:

```json
{
  "question": "...",
  "jobDescription": "...",
  "relevantProfile": {
    "experience": [],
    "skills": [],
    "projects": [],
    "careerGoals": []
  },
  "constraints": {
    "maxWords": 150,
    "tone": "simple, direct, professional",
    "doNotInvent": true
  }
}
```

Use Codex to generate a targeted answer.

Display it in the console before filling:

```text
Generated answer:

...

[A] Accept
[E] Edit
[S] Skip
```

Do not auto-fill generated long-form answers without review by default.

---

# Phase 7 — Job Description Extraction

Extract the job description from:

- the initial job page
- the application page
- accessible page text
- job title
- company
- responsibilities
- requirements
- preferred qualifications

Store one bounded normalized representation for the current run.

Suggested shape:

```js
{
  title,
  company,
  location,
  summary,
  responsibilities,
  requirements,
  preferredQualifications,
  rawText
}
```

Avoid extracting navigation, footer, cookie text, and unrelated content.

Allow the user to provide a job-description file manually when page extraction is insufficient.

---

# Phase 8 — Cover Letter Generation

Add a console command or workflow step:

```bash
npm run generate:cover-letter -- <job-url>
```

Or run it automatically when a cover letter field is detected.

Input:

- job description
- user profile
- CV-supported experience
- configurable cover-letter prompt
- word limit
- preferred tone

Requirements:

- do not invent experience
- preserve factual metrics
- mirror important job-description terminology naturally
- keep the user’s writing style simple and direct
- avoid generic praise and keyword stuffing
- output to console
- optionally save to a local `.txt` or `.md` file
- require user review before browser insertion

Suggested console output:

```text
Generated targeted cover letter:

...

Save? [Y/n]
Fill into application field? [Y/n]
```

Do not require PDF or DOCX generation for the MVP.

---

# Phase 9 — Document Upload

Support configured file uploads:

- resume
- cover letter
- optional supporting documents

Only upload files declared in the profile or CLI arguments.

Before upload:

- confirm file exists
- confirm supported extension
- confirm target appears to be the correct upload field

After upload:

- verify filename or upload state

Do not search the file system for arbitrary documents.

---

# Phase 10 — Navigation

Allow safe navigation actions such as:

- Apply
- Continue
- Next
- Save and continue
- Review application

Never click:

- Submit
- Submit application
- Send application
- Confirm submission
- Finish and submit
- any irreversible equivalent

Before uncertain navigation, show:

```text
The next button may be irreversible.

Proceed manually or confirm the action.
```

The final application state should be:

```text
ready-for-review
```

not:

```text
submitted
```

---

# Phase 11 — Verification and Retry

After every action:

1. re-observe the field or page
2. confirm expected result
3. retry once for reversible failures
4. if still unresolved, ask the user

Do not create a complex autonomous recovery framework.

Examples:

```text
Option selection failed.
Retrying once...

Still unresolved.
Please complete this field manually, then press Enter.
```

---

# Phase 12 — Run Artifact

Every application run must save one compact artifact.

Recommended path:

```text
reports/runs/<run-id>.json
```

Suggested structure:

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
- resolution method:
  - `direct-alias`
  - `codex-semantic`
  - `user-confirmed`
  - `manual`
- verification outcome
- whether user intervention occurred

---

# Phase 13 — Lightweight Analysis and Iterative Improvement

Add:

```bash
npm run analyze:last-run
```

The analyzer should classify issues using a small stable taxonomy:

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

It should generate:

- a concise diagnostic summary
- recurring issue updates
- advisory improvement proposals
- candidate regression tests

It must not automatically modify source code.

---

# Phase 14 — Core Benchmark and Replay

Provide:

```bash
npm run benchmark:core
npm run benchmark:replay
```

## Core Suite

Maintain a small authored suite covering:

- first name
- last name
- email
- phone
- city
- country
- visa type
- visa status
- work authorization
- sponsorship
- school
- degree
- resume
- cover letter
- open questions
- legal/privacy review
- salary safeguard
- final-submit protection

## Historical Replay

Only preserve cases representing:

- a previously incorrect answer
- a safety failure
- a recurring semantic issue
- a new field variation
- a new browser control behavior

Optional command:

```bash
npm run benchmark:add-case -- <run-id>
```

Do not convert every run into a permanent fixture.

---

# Phase 15 — Improvement Proposals

Generate advisory proposals only.

Example:

```json
{
  "title": "Improve visa type and visa status selection",
  "evidence": [],
  "rootCause": "Both profile facts were plausible for the observed field.",
  "genericImprovement": "Pass both candidate facts to Codex and require an explicit selected source.",
  "candidateTests": [],
  "risk": "medium",
  "status": "proposed"
}
```

The developer must explicitly:

- accept
- edit
- reject
- defer

Do not automatically edit production code.

---

# Phase 16 — Run Summary

At the end, print:

```text
Application status: Ready for final review

Filled automatically:
- First name
- Last name
- Email
- Phone
- City
- Country
- Resume

Filled after confirmation:
- Visa type
- Work authorization

Generated:
- Cover letter
- Why are you interested in this role?

Skipped:
- Salary expectation

Manual completion required:
- Privacy declaration

Final submission:
Not performed
```

---

# Phase 17 — Codex Usage Boundary

Use Codex for:

- interpreting unfamiliar field wording
- selecting among supplied profile facts
- mapping a profile value to an available option
- extracting job-description meaning
- generating a cover letter
- generating targeted open-question answers
- explaining uncertainty

Do not use Codex for:

- generating Playwright selectors
- executing arbitrary JavaScript
- bypassing final-submit protection
- fabricating profile facts
- silently consenting to declarations
- making unsupported legal conclusions
- automatically modifying source code based on run analysis

Browser execution remains in Playwright code or Playwright CLI commands.

---

# Tests

Add focused tests for:

## Stable fields

- first name
- last name
- email
- phone
- city
- country
- LinkedIn
- portfolio

## Variant fields

- visa type
- visa status
- work authorization
- sponsorship
- city vs region
- school vs employer
- unfamiliar field wording

## Human review

- accept suggestion
- edit suggestion
- skip field
- manual completion and resume

## Generated text

- cover letter uses JD and profile
- generated answer does not invent experience
- word limit is respected
- user review occurs before filling

## Browser actions

- text fill
- option select
- checkbox
- upload
- safe navigation
- one retry
- manual fallback

## Safety

- final Submit is never clicked
- salary is not guessed
- legal/privacy declaration requires confirmation
- unsupported work eligibility becomes review
- arbitrary file upload is rejected

## Benchmark and iteration

- run artifact is generated
- failure taxonomy is stable
- recurring issue aggregation works
- improvement proposals are advisory only
- core benchmark passes
- historical failure replay works
- benchmark cases are not added automatically
- safety cases remain permanent

---

# Acceptance Criteria

The MVP is complete when:

- a user can provide a job URL
- common fields are automatically filled
- field variants can be resolved using context and candidate profile facts
- uncertain fields request human input
- visa type and visa status are not blindly treated as identical
- open-ended answers can be generated from the job description and profile
- a targeted cover letter can be generated in the console
- resume upload works
- failed actions retry once and then request manual help
- completed fields are not repeatedly filled
- the workflow stops before final submission
- no paid API is required by the primary workflow
- the final console summary is clear
- each run produces a compact artifact
- recurring issues can be analyzed
- selected historical failures can be replayed
- improvement proposals remain advisory
- the active codebase remains small and understandable

---

# Constraints

Do not:

- rebuild a general browser-agent platform
- introduce a paid model API requirement
- add a large fixed ATS ontology
- add ATS-specific selectors
- build a self-modifying system
- add multi-provider infrastructure
- add complex benchmark scoring
- add autonomous final submission
- generate unsupported personal facts
- hide uncertainty from the user
- automatically change production code from run analysis

---

# Required Final Report

Return:

1. files changed
2. simplified runtime architecture
3. CLI commands
4. profile structure
5. stable field mappings
6. semantic field-resolution workflow
7. human-review workflow
8. job-description extraction
9. cover-letter generation
10. open-question generation
11. document upload behavior
12. verification and retry behavior
13. run artifact structure
14. lightweight benchmark workflow
15. iterative improvement workflow
16. safety rules
17. tests run
18. example console workflow
19. remaining limitations
20. confirmation that no paid API is required
21. confirmation that final submission is never performed
