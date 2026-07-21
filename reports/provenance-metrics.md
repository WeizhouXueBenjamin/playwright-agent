# Decision Provenance Metrics

Per-action provenance:

- `semanticOwner`: who produced the semantic action proposal.
- `approvalOwner`: who approved or blocked execution.

Supported owner values:

- `ai`
- `deterministic-semantic-rule`
- `safety-guard`
- `policy`
- `executor`
- `recovery-logic`
- `user-review`

Runtime counters:

- `aiSemanticDecisionCount`
- `deterministicSemanticDecisionCount`
- `safetyOverrideCount`
- `policyOverrideCount`
- `aiDecisionAcceptedCount`
- `aiDecisionRejectedCount`
- `reviewDecisionCount`

These counters are objective and additive. They do not store subjective
reasoning or confidence fields in Runtime State.
