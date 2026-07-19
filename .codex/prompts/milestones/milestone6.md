Milestone 6 — Autonomous Agent Loop

Read .codex/instructions.md before making any changes.

Objective

Refactor the current execution pipeline into an autonomous iterative agent loop.

The current implementation executes a complete action plan from start to finish.

Replace this architecture with an iterative Observe → Think → Act → Verify loop.

Scope

Implement an AgentController that repeatedly performs:

1. Observe the current browser state.
2. Update the page understanding.
3. Determine the next best action.
4. Execute exactly one action.
5. Verify the result.
6. Repeat until a terminal state is reached.

The loop should support:

- page navigation
- multi-step forms
- dynamic DOM updates
- future LLM reasoning

Constraints

- Do not implement recovery logic.
- Do not implement memory.
- Do not add ATS-specific logic.
- Do not change existing browser capabilities.

Deliverables

- AgentController
- Agent loop
- Execution lifecycle
- Terminal state detection
