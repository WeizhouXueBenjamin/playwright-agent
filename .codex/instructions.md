# Project Constitution

## Vision

This project aims to build a general-purpose AI Browser Agent capable of autonomously completing web-based workflows.

The first application is job applications.

Given only a job application URL, the agent should:

- Open the website
- Understand the page
- Identify every required field
- Retrieve the correct information from the user's profile
- Complete the application
- Upload supporting documents
- Navigate through multi-step forms
- Verify every action
- Stop before the final submission for human confirmation

Think like a software architect, not a code generator.

Prioritize maintainability, modularity, and extensibility over quickly producing working code.

Whenever multiple implementations are possible, explain the trade-offs and choose the one that best aligns with the project constitution.

The long-term objective is to allow the user to simply provide:

> A URL

Everything else should be handled autonomously.

---

# Core Philosophy

This is NOT a Playwright automation project.

This is NOT a collection of browser scripts.

This is an AI Browser Agent.

Playwright is only the browser execution engine.

The intelligence should come from reasoning, planning, observation, and verification rather than hardcoded selectors.

---

# First Principles

Treat every website as unseen.

Never assume a page follows a predefined layout, CSS structure, or ATS platform.

The agent should infer page structure from:

- semantic HTML
- labels
- placeholders
- accessibility metadata
- DOM hierarchy
- surrounding context
- visual information
- reasoning

When deterministic parsing is insufficient, prefer reasoning over hardcoded rules.

Generalization is always more valuable than optimizing for a single website.

The objective is not to automate Workday, Greenhouse, Lever, or any specific ATS.

The objective is to build a browser agent capable of understanding arbitrary web applications.

Whenever there is a trade-off between supporting one website and improving the agent's ability to generalize, always choose generalization.

---

# Design Principles

## 1. AI First

The browser should execute actions.

The AI should make decisions.

Whenever uncertainty exists, the LLM should determine:

- what a field represents
- what information should be entered
- whether confidence is sufficient
- whether user confirmation is required

Never replace reasoning with large collections of hardcoded mappings.

---

## 2. Semantic Over Selectors

Never depend on fragile selectors unless absolutely necessary.

Prefer understanding through:

- labels
- placeholder text
- accessible names
- aria-label
- nearby descriptions
- page hierarchy

instead of:

- CSS selectors
- XPath
- DOM indexes

Selectors are implementation details.

Semantics are intent.

---

## 3. Observe → Think → Act → Verify

Every browser interaction must follow the same cycle.

Observe

↓

Think

↓

Act

↓

Verify

Never click blindly.

Never fill blindly.

Always verify the outcome before continuing.

---

## 4. Verification Before Progress

Every important action must be verified.

Examples include:

- input successfully filled
- file uploaded
- dropdown selected
- page navigation completed
- validation errors resolved

If verification fails:

Observe again.

Reason again.

Retry.

Do not continue blindly.

---

## 5. Explainability

Every decision should be explainable.

The agent should always be able to answer:

Why was this field filled?

Why was this button clicked?

Where did this value come from?

Why was confidence low?

Explainability is more important than execution speed.

---

## 6. Human Safety

Never automatically submit important forms.

The agent should stop before any irreversible action.

Examples include:

- job application submission
- payment confirmation
- account deletion

Require explicit user confirmation.

---

## 7. Generic Before Platform-Specific

The default implementation should work on arbitrary websites.

Platform-specific optimizations should be implemented as optional plugins.

Never build the architecture around one website.

---

## 8. Reusable Components

Every capability should be reusable.

Examples include:

- FillText()
- Click()
- UploadFile()
- DetectField()
- DetectATS()
- AnalyzePage()

Business logic must never be embedded inside Playwright scripts.

---

## 9. Single Responsibility

Every module should have one responsibility.

Avoid large utility files.

Prefer many focused modules over giant files.

---

# System Architecture

The project should gradually evolve into the following architecture.

```
                Job URL
                   │
                   ▼
          Browser Controller
                   │
                   ▼
          Page Understanding
                   │
                   ▼
          Reasoning Engine
                   │
                   ▼
            Action Planner
                   │
                   ▼
         Playwright Executor
                   │
                   ▼
             Verification
                   │
                   ▼
              Next Decision
```

Each layer should only have one responsibility.

---

# Recommended Project Structure

```
src/

    agent/
        planner.ts
        executor.ts
        verifier.ts

    browser/
        browser.ts
        context.ts
        page.ts

    reasoning/
        page-understanding.ts
        field-matching.ts
        confidence.ts

    actions/
        click.ts
        fill.ts
        upload.ts
        select.ts
        checkbox.ts

    parsers/
        dom.ts
        accessibility.ts
        screenshot.ts

    profile/
        profile.ts
        education.ts
        employment.ts

    plugins/
        workday/
        greenhouse/
        lever/

    utils/
```

---

# Coding Standards

Prefer:

Small functions

Small files

Composable modules

Readable code

Explicit names

Pure functions whenever possible

Avoid:

Large classes

Deep inheritance

Massive utility files

Hidden state

Hardcoded business logic

---

# Error Recovery

Assume websites change frequently.

The agent should recover whenever possible.

Recovery flow:

Observe

↓

Reason

↓

Retry

↓

Fallback

↓

Request user assistance

Never immediately terminate because of one failed selector.

---

# Logging

Every important action should be logged.

Examples:

Current page

Detected fields

Confidence score

Reasoning

Chosen action

Verification result

Logs should help reproduce every decision.

---

# Confidence

Every reasoning result should include a confidence score.

Example:

```
Field:
Preferred Name

Matched to:

profile.preferredName

Confidence:
96%
```

If confidence falls below an acceptable threshold:

Pause.

Request user confirmation.

Do not guess.

---

# Future Capabilities

The architecture should support future features without major refactoring.

Examples include:

- Resume parsing
- Resume tailoring
- Cover letter generation
- Job description understanding
- Multi-profile support
- ATS detection
- Login management
- Browser memory
- Vision-based navigation
- OCR
- CAPTCHA assistance
- Voice interaction
- Multi-agent collaboration
- Plugin marketplace

Future expansion should be enabled through modular design rather than rewriting the architecture.

---

# Definition of Success

The project is successful when the user can provide only:

A job application URL

and the agent can autonomously:

- understand the page
- retrieve the correct personal information
- complete every form
- upload required files
- recover from unexpected layouts
- adapt to unseen websites
- explain every decision
- stop before submission for user confirmation

without requiring website-specific scripts.
