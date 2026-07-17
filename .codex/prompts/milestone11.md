Milestone 11 — Observation & Benchmark Collection

Read .codex/instructions.md before making any changes.

Objective

Implement an Observation Mode that allows the Browser AI Agent to inspect real-world job application websites without performing any browser interactions.

The goal is to collect high-quality benchmark data for future evaluation while ensuring zero side effects on the target website.

Scope

Given a job application URL, the agent should:

- launch the browser
- load the webpage
- observe every page
- collect browser observations
- collect semantic page understanding
- collect accessibility information
- collect DOM snapshots
- capture screenshots
- collect console errors
- collect network errors
- collect runtime state
- collect reasoning logs

The agent must never:

- click
- type
- upload
- submit
- navigate intentionally

The observation should stop after the page has fully stabilized.

Constraints

The implementation should work for any website.

No website-specific logic is allowed.

Deliverables

- Observation Mode
- Benchmark Collector
- DOM Snapshot Export
- Accessibility Snapshot Export
- Screenshot Pipeline
- Observation Report
