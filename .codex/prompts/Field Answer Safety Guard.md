# Field Answer Safety Guard

## Context

Greenhouse production apply run exposed a product-critical correctness issue:

The agent filled a salary expectation field with `Full-Stack Engineer`.

The application was not submitted and the agent stopped safely, but entering incorrect information into a real application field is a high-priority product bug.

This must be fixed as a generic answer-selection safety improvement, not as a Greenhouse-specific fix.

---

# Objective

Implement a reusable Field Answer Safety Guard that prevents sensitive or high-risk application fields from being filled with weakly matched profile values.

The agent should prefer stopping for user review over guessing.

---

# Scope

Primary affected areas:

- `src/reasoning/field-matching.js`
- `src/profile/profile-properties.js`
- `src/agent/planner.js`
- `src/agent/next-action.js`, only if needed
- focused tests under `src/reasoning` and/or `src/agent`

Do not change benchmark schema, RWVS report schema, or V1 regression behavior for this fix.

---

# Phased Implementation Plan

Implement this in phases.

Reason:

- the immediate product risk is incorrect field entry, especially salary/legal/consent fields
- the full design touches matching, planning, diagnostics, and replay
- each phase should leave the agent safer than before
- later phases must not delay the P0 safety block

## Phase 0 - Safety Contract And Intent Classification

Goal:

Prevent high-risk fields from being treated as ordinary generic matches.

Implement:

- add `src/reasoning/field-answer-safety.js`
- export the guard decision contract
- implement `classifyFieldIntent(field)`
- classify at least:
  - salary-expectation
  - current-salary
  - work-authorization
  - sponsorship-required
  - visa-type
  - legal-declaration
  - privacy-consent
  - referral-source
  - low-risk
- collect deterministic evidence from label, label candidates, placeholder, options, visible text, and semantic evidence

Acceptance:

- salary expectation is classified before generic matching creates a planned answer
- privacy/legal/referral fields are classified as high-risk
- low-risk fields remain low-risk
- no website-specific rules

Tests:

- direct unit tests for `classifyFieldIntent`
- salary/referral/legal/consent labels classify correctly
- first name, email, city, country classify as low-risk

## Phase 1 - Property Allowlist Guard

Goal:

Stop unsafe profile-property substitutions before planning.

Implement:

- implement `evaluateFieldAnswerSafety(field, matchedProfileProperty)`
- apply high-risk allowlists by intent
- reject unsafe matches with a structured safety decision
- preserve the safety decision on match or review output
- update `field-matching.js` or `planner.js` so rejected sensitive matches become review items, not action steps

Acceptance:

- salary expectation does not consume `targetRole`, `jobTitle`, `summary`, experience, skills, or education
- legal sub-intents do not infer from each other
- consent defaults to review without exact authorization
- referral/source does not consume ordinary source metadata
- normal low-risk fields still plan normally

Tests:

- salary expectation without explicit salary property returns review
- `requiresSponsorship: false` does not answer legal work authorization
- privacy consent broad profile flag is rejected
- normal low-risk fields continue to match

## Phase 2 - Value Compatibility Guard

Goal:

Prevent correct-looking explicit properties from filling incompatible field formats.

Implement:

- implement `validateSensitiveFieldValue(input)`
- check empty values, numeric compatibility, option compatibility, boolean compatibility, salary intent mismatch, salary currency/period ambiguity, and consent authorization shape
- attach value compatibility failures to the safety decision

Acceptance:

- explicit salary property is only allowed when compatible with the field
- current salary and expected salary do not cross-fill
- annual salary is not used for hourly-rate fields when the form requires hourly format
- select/radio values must match available options
- yes/no questions require explicit boolean-compatible values

Tests:

- salary expectation with `Negotiable` is rejected for numeric-only field
- desired hourly rate rejects annual salary format
- option mismatch creates review item
- explicit compatible salary value can plan

## Phase 3 - Diagnostics, Product Summary, And Replay

Goal:

Make the guard explainable and verify the Greenhouse product workflow.

Implement:

- include safety decisions in review items
- expose guard reasons in decision context, failure analysis, or V2 diagnostics where existing structures allow additive fields
- keep V1 benchmark and regression behavior unchanged
- rerun the Greenhouse production apply workflow after tests pass

Acceptance:

- final product summary can say the agent did not guess sensitive answers
- Greenhouse salary field is not filled with `targetRole` or `jobTitle`
- unresolved salary/legal/privacy/referral fields become `needs-review`
- no final submission occurs
- no website-specific fix is introduced

Tests:

- run focused tests from earlier phases
- run `npm run test:decision-cycle`
- run `npm run test:partial-execution`
- run broader benchmark/RWVS tests if shared report or diagnostics code changes

---

# Required Rule Support

Add a reusable rule module instead of hardcoding this only inside one workflow prompt.

Recommended new module:

- `src/reasoning/field-answer-safety.js`

Responsibilities:

- classify high-risk field intents
- define allowed profile properties per high-risk intent
- reject unsafe profile-property matches
- validate value compatibility for high-risk fields
- return deterministic review reasons
- return a reusable safety decision contract

This module should be used by planning or field matching so the same guard applies to:

- production apply runs
- benchmark runs
- validation tests
- future ATS platforms

---

# Feasibility Assessment

This fix is feasible with the current architecture.

Existing support:

- `field-matching.js` already has field labels, label candidates, placeholders, options, semantic evidence, candidate profile properties, values, and confidence scores.
- `planner.js` already has a review item path and can avoid creating executable action steps.
- `next-action.js` already consumes planner output and can return `needs-review`.
- runtime state already records completed fields, so this guard can coexist with skip-verified-field behavior.

Main implementation risk:

- applying the guard too late, after a weak generic match has already been converted into an executable step.

Mitigation:

- sensitive intent classification must happen before a candidate profile property is converted into a planned answer.
- the safety guard must be authoritative over generic similarity and confidence scores.

---

# Guard Decision Contract

Do not return a bare boolean.

Return a structured decision that can be reused by planner, failure analysis, post-mortem, V2 diagnostics, and tests.

Rejected example:

```js
{
	allowed: false,
	fieldIntent: "salary-expectation",
	riskLevel: "high",
	matchedProperty: "targetRole",
	reason: "sensitive-field-unsafe-profile-match",
	requiresReview: true,
	evidence: [
		{
			source: "label",
			value: "What are your salary expectations?"
		}
	]
}
```

Allowed example:

```js
{
	allowed: true,
	fieldIntent: "salary-expectation",
	riskLevel: "high",
	matchedProperty: "salaryExpectation",
	reason: "explicit-profile-value-approved",
	requiresReview: false,
	evidence: [
		{
			source: "label",
			value: "What are your salary expectations?"
		}
	]
}
```

Recommended exported functions:

```js
classifyFieldIntent(field)
evaluateFieldAnswerSafety(field, matchedProfileProperty)
validateSensitiveFieldValue(input)
```

The returned decision must be deterministic and must include enough evidence to explain why an action was blocked.

---

# Required Evaluation Order

The correct order is:

Extract field evidence

-> Classify field intent

-> Determine risk

-> Generate candidate profile matches

-> Apply safety allowlist

-> Validate value compatibility

-> Plan action or review item

Do not implement this as:

Generic best profile match

-> Planned answer

-> Late sensitive-field check

Sensitive intent classification must occur before a candidate profile property is converted into a planned answer.

The safety guard must override generic text similarity and confidence scores.

---

# Sensitive Field Categories

At minimum, guard these categories:

## Salary / Compensation

Field signals:

- salary
- compensation
- expected pay
- pay expectation
- remuneration
- desired salary
- hourly rate
- current salary

Allowed profile properties:

- explicit salary expectation property only, if the profile has one

Do not use `salaryExpectation` for current salary unless the profile has an explicit current-salary property and the user has authorized its use.

Disallowed substitutions:

- targetRole
- jobTitle
- summary
- experience descriptions
- skills
- education

If no explicit salary expectation exists, produce a review item.

If the value is explicit but the field asks for a different format, produce a review item.

Examples:

- numeric-only field with value `Negotiable`
- hourly-rate field with annual-salary value
- salary field without clear currency, period, or range when the form requires one

## Legal / Work Eligibility

Field signals:

- work eligibility
- right to work
- legally authorized
- visa
- sponsorship
- require sponsorship

Sub-intents:

- work-authorization
- sponsorship-required
- visa-type
- legal-declaration

Allowed profile properties by sub-intent:

- work-authorization: `workAuthorization`
- sponsorship-required: `requiresSponsorship`
- visa-type: explicit visa-type property only, if present
- legal-declaration: no automatic answer unless the user explicitly authorized that declaration

If the field asks for a declaration or ambiguous legal answer, produce a review item.

Do not infer one legal intent from another.

Examples:

- `requiresSponsorship: false` does not prove the user is legally entitled to work in the current country.
- `workAuthorization` does not automatically answer a sponsorship question unless the question clearly asks for work authorization.

## Privacy / Consent / Declarations

Field signals:

- privacy policy
- consent
- declaration
- terms
- agree
- acknowledge

Allowed behavior:

- do not auto-check legal/privacy/declaration fields unless the user has explicitly authorized that exact consent.

Authorization must be scoped to the current statement. A broad profile flag such as `acceptsPrivacyPolicy: true` is not enough.

Future-compatible authorization shape:

```js
{
	authorizationType: "consent",
	consentScope: "privacy-policy",
	statementFingerprint: "...",
	authorized: true,
	authorizedAt: "..."
}
```

If this structure does not exist, default to `needs-review`.

Default outcome:

- needs-review

## Referral / Source

Field signals:

- referral
- how did you hear
- source
- referred by

Allowed profile properties:

- explicit referral/source property only, if present

Do not match ordinary profile metadata, source paths, file paths, resume source, or unrelated source-like fields.

Default outcome:

- needs-review

---

# Value Compatibility

Intent/property compatibility is necessary but not sufficient.

For high-risk fields, validate that the matched value is compatible with the target field.

Add or support:

```js
validateSensitiveFieldValue({
	intent,
	value,
	fieldType,
	options,
	constraints,
	field
})
```

At minimum, check:

- empty values are rejected
- numeric-only fields receive numeric-compatible values
- select/radio fields receive values that match an available option
- yes/no questions receive explicit boolean-compatible answers
- salary values do not cross incompatible salary intents, such as current salary vs expected salary
- salary period and currency ambiguity produces review when the field requires specificity
- legal declarations require exact user authorization

If value compatibility fails, the planner must create a review item instead of an executable action.

Recommended reasons:

- `sensitive-field-empty-value`
- `sensitive-field-value-format-mismatch`
- `sensitive-field-option-not-available`
- `sensitive-field-ambiguous-value`
- `legal-consent-requires-current-statement-authorization`

---

# Implementation Requirements

The guard must be deterministic.

Do not use LLM subjective scoring.

Do not rely on website-specific selectors, labels, or platform names.

For each candidate field/profile match:

1. classify field intent from label, label candidates, placeholder, options, visible text, and semantic evidence
2. if field intent is high-risk, check whether the matched profile property is explicitly allowed
3. if the matched profile property is allowed, validate the field value compatibility
4. if not allowed or not value-compatible, reject the action and create a review item
5. include a clear reason such as:
   - `sensitive-field-no-explicit-profile-value`
   - `sensitive-field-unsafe-profile-match`
   - `legal-consent-requires-user-review`
   - `salary-expectation-requires-explicit-answer`
   - `sensitive-field-value-format-mismatch`
   - `legal-consent-requires-current-statement-authorization`

The planner must not create an executable action step from a rejected sensitive-field match.

The review item should preserve the safety decision contract so reports can explain the stop without reclassifying the field.

---

# Expected Behavior

For a salary expectation field:

- do not fill `targetRole`
- do not fill `jobTitle`
- do not fill experience titles
- do not fill current salary into expected salary
- if profile lacks explicit salary expectation, return `needs-review`
- if an explicit salary value is incompatible with the field constraints, return `needs-review`

For privacy policy or legal consent:

- do not auto-check by default
- return `needs-review` unless exact current-statement user authorization exists

For work eligibility:

- only use explicit `workAuthorization` or `requiresSponsorship` for their matching legal sub-intent
- do not infer work authorization from sponsorship preference, or sponsorship preference from work authorization
- otherwise return `needs-review`

For ordinary fields:

- first name, last name, email, phone, city, country, school, degree, resume, and cover letter should continue to work normally

---

# Tests

Add focused tests proving:

- salary expectation does not match `targetRole`
- salary expectation without explicit profile salary value becomes a review item
- salary expectation with explicit profile salary value can be planned
- salary expectation with incompatible field constraints becomes a review item
- current salary does not use salary expectation
- desired hourly rate does not accept annual salary when the field requires hourly format
- legal/privacy consent is not auto-checked without explicit authorization
- legal/privacy consent requires current statement authorization, not a broad profile flag
- work eligibility can use explicit workAuthorization / requiresSponsorship
- `requiresSponsorship: false` does not answer legally entitled to work questions
- sponsorship questions do not consume `workAuthorization` unless the question explicitly asks for authorization
- "How did you hear about us?" does not match ordinary profile source metadata
- normal low-risk fields still match and plan as before

Run at minimum:

- `npm run test:field-matching`
- `npm run test:planner`
- `npm run test:decision-cycle`
- `npm run test:partial-execution`

Run broader tests if touched modules affect shared behavior.

---

# Validation

After implementation, rerun the Greenhouse apply workflow.

Success criteria:

- the salary expectation field is not filled with target role or job title
- missing salary expectation becomes a clear `needs-review` blocker
- already verified fields are still skipped
- unresolved legal/privacy/referral fields request review
- no final submission occurs
- no website-specific fix is introduced

The expected outcome may still be `needs-review`. That is acceptable if the agent stops because explicit user input is required.

---

# Final Report

Summarize:

- files changed
- rule module added
- sensitive categories covered
- tests run
- Greenhouse replay result, if run
- confirmation that no final submission occurred
- any remaining blocker
