Milestone 7 — Verified Runtime State

Read .codex/instructions.md before making any changes.

Objective

Implement a Verified Runtime State (Fact Store) that serves as the single source of truth for the agent during execution.

The runtime state must contain only information that has been directly observed from the browser or successfully verified after execution.

It must never contain assumptions, inferred intent, speculative reasoning, or LLM-generated beliefs.

Reasoning belongs to future milestones.

Scope

Implement a runtime state that tracks only verified facts, including:

- current goal
- current URL
- current page title
- current browser state
- detected forms
- detected fields
- completed fields
- remaining required fields
- uploaded files
- navigation history
- completed actions
- current execution status
- validation errors confirmed by the browser
- timestamps when appropriate

The Agent Loop should update the runtime state after every observation and every successful action verification.

Every state update must originate from browser observations or explicit execution verification.

Constraints

The runtime state must NEVER contain:

- inferred page intent
- predicted next page
- semantic assumptions
- reasoning results
- confidence scores
- LLM thoughts
- speculative information

Every value stored must be directly verifiable.

If a fact cannot be verified, it must not be stored.

Design the architecture so future reasoning modules consume the runtime state but never modify it directly.

Deliverables

- Verified Runtime State (Fact Store)
- State Manager
- State Update Pipeline
- Browser Observation → State synchronization
- Action Verification → State synchronization
