# Migration 0 Implementation

## Scope

Migration 0 adds the AI decision boundary without giving AI production authority.
The deterministic planner still selects production actions. Every action now passes
through a deterministic Decision Gate before browser execution.

## Implemented Phases

- Phase 1: Observation v2 contract added beside Observation v1.
- Phase 2: Relevant profile fact retrieval added for bounded candidate retrieval.
- Phase 3: Decision v2 discriminated union added.
- Phase 4: Mandatory deterministic Decision Gate added.
- Phase 5: Production controller, standalone execute-plan, partial execution via controller, benchmark execution via partial execution, and recovery retries now gate actions.
- Phase 6: Decision provenance counters and action provenance added.
- Phase 7: Disabled, fixture, and shadow semantic decision providers added.
- Phase 8: Low-risk shadow fixture definitions and report builder added.

## Execution Boundary

Production execution now follows:

Structured Observation -> deterministic semantic proposal -> Decision Gate ->
approved internal capability action -> browser execution -> deterministic
verification -> Runtime State update.

AI provider decisions are available only as shadow/fixture outputs and are not
used as production action authority.

## Compatibility

Observation v1 and Decision v1 remain present. The v2 contracts are additive.
Existing deterministic planning continues to produce legacy steps; those steps
are adapted into Decision v2 proposals immediately before the gate.

## Safety

The gate uses the conservative union of risk:

AI-sensitive, deterministic-sensitive, or ambiguously sensitive means sensitive.
AI cannot lower deterministic risk. Field Answer Safety Guard and policy
evaluation remain mandatory gate checks.

## Final Submission

Final submit controls remain blocked by policy. No final submission was added or
performed by this migration.
