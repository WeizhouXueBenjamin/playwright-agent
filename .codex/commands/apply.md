# Browser AI Agent - Real Job Application

## Purpose

Complete a real job application as reliably and efficiently as possible.

This is a production task workflow, not a benchmark workflow.

Primary objective:

Complete all safe and reversible application steps, use verified runtime state to avoid repeated work, request user input only when necessary, and stop immediately before final submission.

Do not optimize for benchmark coverage, diagnostics generation, capability discovery, regression replay, or improvement proposal generation during the active task.

---

# Input

Required:

- Job URL supplied by the user

Optional:

- profile path
- resume path
- cover letter path
- answers/configuration path

When optional paths are not supplied, use the project's configured default profile and documents.

---

# Operating Mode

Execution Mode: headed, persistent

Browser: Chromium

Use the existing authenticated browser session when available.

Preserve browser state during the task.

Do not create an account unless the user explicitly approves account creation.

---

# Primary Workflow

Open Target URL

-> Observe Current Page

-> Determine Current Goal

-> Select Next Safe Action

-> Execute

-> Verify

-> Update Runtime State

-> Continue Until Review or Blocked

The active task loop is:

Observe
-> Decide
-> Execute
-> Verify
-> Update Runtime State

Do not run the full benchmark, regression, capability history, or improvement proposal pipeline during this loop.

---

# Task Priorities

Use this priority order:

1. Safety
2. Correctness
3. Task completion
4. Verification reliability
5. Efficiency
6. Lightweight artifacts

Do not sacrifice task correctness to increase coverage or collect benchmark data.

---

# Application Entry

When the current page is a job-detail page:

- identify the primary application entry point
- distinguish application navigation from final submission
- allow safe navigation through controls such as Apply, Apply Now, Start Application, and Continue Application
- verify the resulting navigation
- continue into the application workflow

Do not treat application-entry navigation as final submission.

---

# Form Completion

Complete fields using verified user data.

Use:

- field labels
- associated label elements
- aria-label
- aria-labelledby
- placeholder
- nearby semantic text
- fieldset and legend
- section headings
- form structure
- autocomplete attributes
- existing runtime state
- prior verified field mappings

Prefer explicit evidence over inference.

Never invent:

- personal information
- work experience
- education
- salary expectations
- legal eligibility
- visa status
- demographic answers
- professional qualifications
- references

When a required field cannot be answered reliably, mark it as unresolved and request user review.

---

# Runtime State Rules

Runtime State is authoritative for completed work.

Before planning an action:

- check whether the field has already been verified
- skip verified completed fields
- avoid repeating successful actions
- avoid replacing valid user-entered values
- preserve previously verified uploads
- preserve verified navigation state

A field is complete only after verification succeeds.

---

# Documents

Use the configured resume and cover letter when requested by the application.

Before upload:

- verify the requested document type
- verify the selected file
- avoid uploading the same file repeatedly

After upload:

- verify the file appears in the application
- record the verified upload in Runtime State

Do not upload unrelated documents.

---

# User Input And Review

Request user input only when the task cannot safely continue.

Examples:

- required field has no reliable semantic identity
- required answer is not available in the user profile
- ambiguous legal or eligibility question
- account credentials are required
- CAPTCHA or unsupported human verification appears
- website requests sensitive confirmation
- multiple plausible answers exist
- unexpected final confirmation appears

When requesting review, provide:

- the field or blocker
- the visible question
- available options
- why the Agent cannot answer objectively
- the minimum information needed to continue

Do not ask the user to repeat information already available in Runtime State or configured profile data.

---

# Safety Rules

Never perform final submission automatically.

Never click controls whose primary meaning is:

- Submit Application
- Final Submit
- Confirm Submission
- Send Application
- Complete Application

Stop before the irreversible action and present the completed application for user review.

Do not:

- create an account without explicit approval
- accept legal declarations on behalf of the user without approval
- provide false information
- bypass CAPTCHA
- bypass access controls
- conceal automation
- submit duplicate applications

---

# Terminal Outcomes

The task must end with one of these outcomes:

## ready-for-review

The application is complete or substantially complete and is positioned immediately before final submission.

## needs-review

The application can continue after the user supplies information or resolves an ambiguity.

## login-required

Authentication or account access is required.

## human-verification-required

CAPTCHA or another unsupported human verification blocks progress.

## unsupported-component

A required interactive component cannot currently be handled reliably.

## policy-stopped

The next action is irreversible or requires explicit user approval.

## application-unavailable

The listing is closed, removed, inaccessible, or no longer accepting applications.

## failed

A technical failure prevented safe continuation.

Do not classify a safe review stop as a failure.

---

# Product Success Outcome

Separate task execution outcome from product success outcome.

Product success examples:

- reaching final review without submitting is success
- clearly asking for one missing user answer is success
- stopping at login is partial success
- stopping safely on an unlabeled required field is acceptable degradation
- looping until max cycles is failure
- filling incorrect information is severe failure
- submitting without confirmation is severe safety failure

---

# Lightweight Run Artifacts

During the task, preserve normal execution artifacts required for later diagnostics:

- observationReport
- executionReport
- executionTimeline
- runtimeTimeline
- finalRuntimeState
- policyEvaluation
- verificationResults
- failureReport, when applicable

Do not generate the full benchmark, regression replay, capability aggregation, or improvement proposal pipeline during active execution.

Artifacts must be sufficient for a later analyze-run command.

---

# Required User-Facing Result

At the end of the run, provide a concise production summary.

Include:

- platform
- current page
- terminal outcome
- product success outcome
- fields completed
- documents uploaded
- unresolved items
- current blocker, if any
- whether the application is ready for review
- confirmation that no final submission occurred

Then state exactly one next user action.

Examples:

- Review the completed application and submit it manually.
- Provide the missing answer for the required field.
- Sign in to continue.
- Complete the CAPTCHA in the open browser.

Do not include full benchmark diagnostics in the production result.

---

# Post-run Handoff

After the production task is complete, artifacts may be processed by:

`.codex/commands/analyze-run.md`

That analysis may generate:

- V2 diagnostics
- post-mortem
- task outcome
- efficiency metrics
- capability gaps
- improvement proposals
- capability history

The production task must not automatically modify source code.
