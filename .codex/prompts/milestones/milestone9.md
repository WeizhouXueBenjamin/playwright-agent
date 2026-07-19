Milestone 9 — Adaptive Reasoning

Read .codex/instructions.md before making any changes.

Objective

Enable the agent to adapt to previously unseen workflows.

The agent should no longer assume that the next page follows an expected structure.

Scope

The agent should recognize and adapt to situations including:

- cookie banners
- modal dialogs
- login pages
- resume parsing pages
- confirmation dialogs
- onboarding flows
- unexpected intermediate pages
- dynamic validation messages

Introduce a reasoning layer that determines what the current page represents and what the next objective should be.

Constraints

- Do not implement ATS plugins.
- Do not hardcode platform-specific workflows.
- The reasoning should remain generic.

Deliverables

- Adaptive reasoning layer
- Unexpected page handling
- Page intent detection
- Dynamic workflow adaptation
