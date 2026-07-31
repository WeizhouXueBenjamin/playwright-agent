Follow repository instructions and read `.codex/prompts/PROJECT_DIRECTION.md` before doing anything else.

I will provide a proposed product direction below.

Your task is to evaluate it against the current product definition and repository architecture, then produce the smallest practical implementation direction.

Do not modify code yet.

## Product Direction

<PASTE PRODUCT DIRECTION HERE>

## Review Process

### 1. Understand the product intent

Summarize the proposed direction in a few sentences.

Identify:

* the user problem it solves;
* the intended workflow change;
* the expected user benefit;
* the important safety or product boundaries.

Do not expand the scope beyond what was proposed.

### 2. Check product alignment

Evaluate the direction against `.codex/prompts/PROJECT_DIRECTION.md`.

Determine:

* whether it directly improves the personal application workflow;
* whether it reduces repetitive user work;
* whether it preserves human control;
* whether it preserves factual, legal, privacy, and final-submit safeguards;
* whether it fits the local, personal, zero-additional-API-cost product model;
* whether it introduces unnecessary platform architecture.

Use the Development Decision Checklist in `PROJECT_DIRECTION.md`.

Classify the proposal as:

```text
Aligned
Aligned with constraints
Needs refinement
Conflicts with product direction
```

If there is a genuine conflict, explain it clearly.

Do not silently weaken or reinterpret `PROJECT_DIRECTION.md`.

### 3. Inspect the current implementation

Trace only the parts of the repository directly relevant to this direction.

Identify:

* current behavior;
* current ownership boundaries;
* existing modules/contracts that can be reused;
* the main limitation causing the current product gap;
* likely compatibility constraints;
* relevant existing tests.

Do not perform unrelated architecture review.

### 4. Evaluate solution options

Consider only realistic approaches that fit the current project.

For each meaningful option, briefly evaluate:

* product fit;
* implementation complexity;
* user experience;
* safety/correctness risk;
* compatibility with existing architecture;
* maintenance cost.

Avoid speculative future architecture.

Do not propose frameworks, schemas, abstractions, providers, or infrastructure unless they solve a demonstrated current problem.

### 5. Recommend the smallest viable approach

Choose one recommended direction.

Optimize in this order:

1. correctness and safety;
2. user convenience;
3. simplicity;
4. reuse of existing architecture;
5. maintenance cost;
6. extensibility only where currently necessary.

Prefer modifying an existing path over creating a parallel one.

If the requested direction is technically unsafe, unsupported, or disproportionately complex, recommend the closest practical alternative.

### 6. Produce a minimal implementation plan

Do not implement yet.

Include only:

* current limitation/root cause;
* recommended approach;
* files/modules likely to change;
* behavior changes;
* user interaction changes;
* safety behavior that must remain unchanged;
* focused tests required;
* one real-run validation scenario where useful;
* fallback or rollback behavior if relevant.

Keep the plan bounded.

Do not turn it into a full technical specification unless the change genuinely requires one.

### 7. Check for over-design

Before finalizing the recommendation, explicitly ask:

* Can this be solved with fewer changes?
* Is any new abstraction actually needed?
* Are we solving a current problem or a hypothetical future one?
* Is the test scope proportional to the change?
* Does the proposed implementation increase runtime complexity more than the user benefit justifies?

Remove unnecessary complexity from the final recommendation.

## Output Format

Return:

```text
1. Product Intent
2. Product Alignment
3. Current Implementation Findings
4. Options Considered
5. Recommended Approach
6. Minimal Implementation Plan
7. Tests / Validation
8. Risks / Limitations
9. Over-Design Check
10. Go / Refine / No-Go
```

Keep the output concise and implementation-oriented.

Do not modify files, create commits, or begin implementation in this task.
