Milestone 8 — Recovery Engine

Read .codex/instructions.md before making any changes.

Objective

Enable the agent to recover from failures instead of terminating execution.

The agent should detect unexpected situations, determine why progress stopped, and attempt recovery before failing.

Scope

Implement recovery for:

- validation errors
- missing required fields
- unexpected navigation
- failed clicks
- upload failures
- stale elements
- dynamic page changes

Recovery strategies may include:

- retry
- re-observe
- backtrack
- re-plan
- request user confirmation

Constraints

- Recovery should be generic.
- Never hardcode ATS-specific behavior.
- Do not introduce LLM reasoning yet.

Deliverables

- Recovery engine
- Retry policy
- Recovery strategies
- Failure classification
