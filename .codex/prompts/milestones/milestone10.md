Milestone 10 — Autonomous Goal Completion

Read .codex/instructions.md before making any changes.

Objective

Transform the browser automation framework into a goal-driven Browser AI Agent.

The agent should continuously pursue a single objective:

Complete the job application.

Instead of executing predefined plans, the agent should repeatedly evaluate its current progress and determine the next best action until the objective is achieved.

Scope

Given only:

- Job application URL
- User profile
- Resume
- Cover letter

The agent should autonomously:

- launch the browser
- understand each page
- complete required fields
- upload required documents
- navigate multi-step workflows
- recover from unexpected situations
- adapt to unseen pages
- verify every important action
- explain every decision
- stop before final submission

The implementation should require no website-specific scripts for common workflows.

Constraints

- Maintain browser independence.
- Maintain modular architecture.
- Preserve explainability.
- Preserve human confirmation before irreversible actions.

Deliverables

- Fully autonomous Browser AI Agent
- Goal-driven execution
- Explainable decision logs
- End-to-end demonstration

Acceptance Criteria

The implementation is considered complete when the agent can:

- Accept only a job application URL and a user profile as input.
- Complete a real multi-step job application without predefined selectors or workflow scripts.
- Adapt to at least one previously unseen application flow.
- Recover from common validation failures and continue execution.
- Produce a complete reasoning log explaining every significant decision.
- Pause before the final submission and request explicit user confirmation.
