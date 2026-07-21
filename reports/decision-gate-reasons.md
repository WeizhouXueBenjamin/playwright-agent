# Decision Gate Reason Catalogue

Gate result types:

- `approved-action`
- `rejected-decision`
- `review-item`

Validation order:

1. Validate Decision v2 schema.
2. Bind decision to the current observation ID and fingerprint.
3. Confirm target element exists.
4. Confirm target state supports the proposed action.
5. Confirm proposed capability is allowlisted for the target.
6. Confirm referenced profile fact exists.
7. Confirm repeated path, value, provenance, and scope match the referenced fact.
8. Run conservative field-risk classification.
9. Run Field Answer Safety Guard.
10. Validate option and structural compatibility.
11. Run policy evaluation.
12. Check Runtime State contradictions and already-completed state.
13. Validate expected postcondition against an allowlisted verifier.
14. Issue a reason-coded immutable gate result.

Reason codes:

- `decision-gate-approved`: all validations passed.
- `decision-v2-schema-invalid`: Decision v2 schema validation failed.
- `decision-requested-review`: proposal explicitly requested review.
- `decision-not-executable`: proposal type is not executable.
- `stale-observation-fingerprint`: proposal does not bind to current observation.
- `target-element-not-found`: target element ID is not present in current observation.
- `target-state-not-actionable`: target is disabled or readonly.
- `unsupported-target-capability`: proposed capability is not allowlisted for the target.
- `profile-fact-not-found`: referenced fact ID is not available from known facts.
- `profile-fact-audit-mismatch`: repeated fact path, value, provenance, or scope does not match the referenced fact.
- `sensitive-field-unsafe-profile-match`: Field Answer Safety Guard rejected the fact for the field intent.
- `sensitive-field-option-not-available`: proposed sensitive value is incompatible with options.
- `sensitive-field-value-format-mismatch`: proposed sensitive value does not match required format.
- `sensitive-field-empty-value`: proposed sensitive value is empty.
- `legal-consent-requires-current-statement-authorization`: consent/declaration lacks exact statement authorization.
- `policy-blocked-action`: policy engine blocked the action, including final submission.
- `runtime-state-already-completed`: current Runtime State shows this field/fact already completed.
- `unsupported-expected-postcondition`: expected verifier is not allowlisted.
