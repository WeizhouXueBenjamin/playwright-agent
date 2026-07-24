# Migration 0 — AI Decision Boundary Foundation

## Context

The completed architecture audit confirmed that the current production workflow contains no AI semantic decision provider.

The system currently performs semantic decisions through:

- regex and keyword page-intent classification
- profile alias and lexical similarity matching
- fixed location and work-eligibility resolvers
- deterministic planner branches
- deterministic recovery selection

The existing observation, safety, policy, capability execution, verification, Runtime State, and benchmark foundations should be preserved.

Do not enable AI-controlled production actions in this phase.

---

# Objective

Create the enforceable architecture boundary required before AI semantic decisions can safely be introduced.

Implement:

1. additive Observation v2
2. additive AI Decision v2 contract
3. mandatory deterministic pre-execution Decision Gate
4. decision provenance and objective counters
5. a non-executing AI decision provider interface
6. fixture-based shadow-decision support

Current deterministic behavior must remain authoritative during this phase.

---

# Target Execution Boundary

All execution entry points must follow:

Structured Observation  
-> semantic decision proposal  
-> deterministic Decision Gate  
-> approved internal capability action  
-> browser execution  
-> deterministic verification  
-> Runtime State update

No plan or action may reach browser execution without a successful gate result.

This must apply to:

- production apply workflow
- partial execution
- benchmark execution
- standalone plan execution
- recovery-generated actions

---

# Phase 1 — Observation v2

Add an additive Observation v2 contract.

Do not remove or mutate Observation v1.

Observation v2 should expose raw structured evidence, not final semantic truth.

Include:

- observation ID
- observation fingerprint
- URL and title
- task goal
- page summary
- semantic sections and headings
- observed elements with opaque element IDs
- label candidates and sources
- placeholder
- bounded nearby text
- control type and raw structural attributes
- available options
- structural constraints
- current observed value/state
- supported abstract capabilities
- Runtime State summary
- recent bounded decision/action/verification history
- current blockers
- immutable policy summary
- immutable safety summary

Do not expose Playwright selectors or locator code.

Do not preassign a final field intent or profile property as truth.

Legacy semantic patterns may appear only as non-authoritative candidate signals.

---

# Phase 2 — Relevant Profile Facts

Create a deterministic profile-fact retrieval layer.

It may use:

- existing aliases
- lexical similarity
- embeddings if already available
- profile structure
- field evidence

Its purpose is retrieval only.

Return a bounded candidate list containing:

- factId
- exact property path
- value
- value type
- provenance
- explicit or derived status
- scope
- freshness if available

Do not select the final fact.

Do not allow derived facts to satisfy explicit-sensitive-answer requirements by default.

Include an explicit “no suitable fact available” possibility.

---

# Phase 3 — Decision v2 Contract

Add an additive discriminated Decision v2 union:

- `act`
- `request-review`
- `no-action`
- `recovery-proposal`

An executable `act` proposal must include:

- decision ID
- observation ID and fingerprint
- goal
- target element ID
- interpreted page goal
- interpreted field intent
- evidence references
- selected profile fact ID
- repeated fact path/value/provenance for audit
- proposed abstract capability
- proposed value
- expected postcondition
- uncertainty
- alternatives considered
- review requirement

AI decisions must never include:

- selectors
- locator strategies
- Playwright code
- JavaScript
- arbitrary executable commands

Keep Decision v1 for compatibility.

---

# Phase 4 — Mandatory Deterministic Decision Gate

Add one authoritative pre-execution gate used by every execution entry point.

The gate must return only:

- `approved-action`
- `rejected-decision`
- `review-item`

Validation order:

1. validate Decision v2 schema
2. bind decision to current observation ID and fingerprint
3. confirm target element exists
4. confirm target state supports the proposed action
5. confirm proposed capability is allowlisted for the target
6. confirm referenced profile fact exists
7. confirm repeated path/value/provenance exactly match the referenced fact
8. run conservative field-risk classification
9. run Field Answer Safety Guard
10. validate option and structural compatibility
11. run policy evaluation
12. check Runtime State contradictions and already-completed state
13. validate expected postcondition against an allowlisted verifier
14. issue a reason-coded immutable gate result

Use the conservative union:

AI identifies sensitive  
OR deterministic classifier identifies sensitive  
OR meaning is ambiguously sensitive  
-> treat as sensitive

AI must never lower deterministic risk.

Only an `approved-action` may be converted into an internal executable capability step.

---

# Phase 5 — Gate All Execution Paths

Update all execution entry points so no action can bypass the Decision Gate.

At minimum inspect and update:

- AgentController production loop
- partial execution
- benchmark execution
- standalone execute-plan
- recovery-generated actions

Legacy deterministic decisions should be adapted into Decision v2 proposals before execution.

Do not change their semantic authority yet.

---

# Phase 6 — Decision Provenance

Record the semantic and approval owner for every decision.

Supported provenance values:

- `ai`
- `deterministic-semantic-rule`
- `safety-guard`
- `policy`
- `executor`
- `recovery-logic`
- `user-review`

Add objective counters:

- `aiSemanticDecisionCount`
- `deterministicSemanticDecisionCount`
- `safetyOverrideCount`
- `policyOverrideCount`
- `aiDecisionAcceptedCount`
- `aiDecisionRejectedCount`
- `reviewDecisionCount`

Add these fields additively to diagnostics and benchmark aggregation without changing V1 regression behavior.

---

# Phase 7 — AI Decision Provider Interface

Add a provider interface but do not connect it to production execution.

Recommended responsibility:

```js
produceSemanticDecision({
  decisionContext
})
```

The provider returns Decision v2.

Support:

- disabled provider
- fixture provider
- future model provider
- shadow provider

Do not add provider-specific logic to planner, execution, safety, or policy modules.

The project should be able to add or replace a model provider without changing browser capability code.

---

# Phase 8 — Shadow AI Fixtures

Implement non-executing shadow decisions for low-risk synthetic fixtures.

Begin with:

- first name
- email
- phone
- city
- country
- school
- degree

For every case, compare the shadow proposal with the legacy decision:

- selected target
- interpreted intent
- selected fact
- proposed capability
- expected postcondition
- review choice
- Decision Gate result

Do not execute the AI proposal.

Do not change production decision authority.

---

# Tests

Add focused tests proving:

- Observation v1 remains compatible
- Observation v2 preserves raw evidence
- Decision v2 rejects invented target IDs
- Decision v2 rejects invented fact IDs
- repeated fact data must match referenced fact exactly
- selectors and JavaScript fields are rejected
- stale observation fingerprints are rejected
- unsupported capabilities are rejected
- Field Answer Safety Guard cannot be bypassed
- Policy Engine cannot be bypassed
- standalone execute-plan cannot bypass the gate
- recovery actions cannot bypass the gate
- only approved actions execute
- shadow AI decisions never execute
- provenance counters are objective and correct
- V1 regression behavior remains unchanged

Run all affected existing suites and broader regression tests.

---

# Constraints

Do not:

- enable AI-primary production decisions
- weaken Field Answer Safety Guard
- weaken Policy Engine
- remove existing verification
- remove Runtime State
- allow final submission
- add ATS-specific logic
- expose selectors to AI
- allow arbitrary browser commands
- replace deterministic benchmark oracles with an LLM judge
- remove existing deterministic matching yet

---

# Required Deliverables

Generate:

- `reports/migration-0-implementation.md`
- updated contract documentation
- gate validation reason catalogue
- provenance metric documentation
- shadow fixture report

Final report must include:

1. files changed
2. Observation v2 structure
3. Decision v2 structure
4. Decision Gate validation order
5. execution paths now protected by the gate
6. provenance fields and counters
7. tests run
8. V1 compatibility result
9. confirmation that AI decisions are still shadow-only
10. confirmation that no final submission occurred
11. recommended next step for connecting a real model provider

Do not start Migration 1 production authority in this task.
