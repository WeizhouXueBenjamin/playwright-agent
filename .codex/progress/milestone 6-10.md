# Roadmap (Milestones 6–10)

The next phase transforms the automation framework into a true Browser AI Agent.

| Milestone | New Capability                 | What It Adds Beyond Milestone 5                                                                                                                                                         |
| --------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **6**     | **Agent Loop**                 | Replaces one-shot execution with a continuous Observe → Think → Act → Verify loop that makes decisions after every action.                                                              |
| **7**     | **World Model**                | Maintains an internal understanding of the agent's current state, progress, completed tasks, pending tasks, and navigation history.                                                     |
| **8**     | **Recovery**                   | Detects failures, validation errors, unexpected states, and automatically retries, backtracks, or requests assistance instead of terminating.                                           |
| **9**     | **Adaptive Reasoning**         | Handles previously unseen layouts, pop-ups, dialogs, login pages, resume parsing screens, and other dynamic workflows through reasoning instead of predefined rules.                    |
| **10**    | **Autonomous Goal Completion** | Shifts from executing a predefined plan to pursuing a goal. The agent continuously adapts until the application is completed or human confirmation is required before final submission. |

After Milestone 10, the control flow evolves from:

```text
Observe
    ↓
Plan
    ↓
Execute
    ↓
Done
```

to an autonomous agent architecture:

```text
Goal
    ↓
Observe
    ↓
Reason
    ↓
Execute One Action
    ↓
Verify
    ↓
Update World Model
    ↓
Goal Achieved?
    ↓
No ───────────────┐
                  │
                  ▼
              Observe Again
```

At that point, the project transitions from an **intelligent automation framework** into a **goal-driven Browser AI Agent** capable of adapting to real-world job application workflows while keeping a human in the loop for the final submission step.
