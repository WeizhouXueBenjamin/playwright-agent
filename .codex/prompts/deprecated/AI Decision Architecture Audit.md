# Browser AI Agent — AI Decision Architecture Audit

## Context

The original project goal is:

Structured page context  
-> AI semantic reasoning and decision  
-> deterministic validation and safety  
-> code transforms approved decisions into browser actions  
-> deterministic verification updates Runtime State

Recent development may be shifting toward:

fixed field patterns  
-> hardcoded intent classification  
-> fixed profile-property mappings  
-> deterministic planner branches  
-> browser actions

Some deterministic logic is necessary, especially for safety, policy, execution, verification, and irreversible actions. However, ordinary page understanding, field interpretation, profile-fact selection, and next-action planning should remain AI-driven.

Audit the project and determine whether this architectural drift has occurred.

Do not modify production code during this audit.

---

# Objective

Establish the correct responsibility boundary:

## AI owns

- semantic page understanding
- field interpretation
- profile-fact selection
- next-action planning
- ambiguity detection
- goal-directed recovery proposals

## Deterministic code owns

- DOM and accessibility extraction
- structured observation
- decision contracts
- Field Answer Safety Guard
- policy enforcement
- browser capability execution
- action verification
- Runtime State facts
- irreversible-action protection

The intended architecture is:

Page DOM and browser state  
-> deterministic structured observation  
-> AI semantic decision  
-> deterministic decision validation  
-> safety and policy gate  
-> browser capability execution  
-> deterministic verification  
-> Runtime State update  
-> next AI decision

AI must not generate Playwright selectors, arbitrary JavaScript, or directly execute browser actions.

---

# Phase 1 — Decision Ownership Audit

Inspect the full application execution path, including:

- semantic page generation
- field matching
- profile-property selection
- planner
- next-action
- decision contracts
- Field Answer Safety Guard
- policy evaluation
- capability selection
- execution
- verification
- Runtime State
- recovery
- production apply workflow
- benchmark workflow

For every major decision point, report:

- file and function
- input
- output
- current decision owner:
  - AI
  - deterministic semantic rule
  - keyword/pattern matching
  - safety/policy guard
  - execution adapter
  - verification
- whether the current owner is appropriate
- recommended owner
- migration risk

Generate:

- `reports/ai-decision-ownership-audit.md`

Include a table:

| Decision | Current Owner | Code Evidence | Recommended Owner | Recommendation |
|---|---|---|---|---|

Trace the actual execution path. Do not infer ownership from filenames alone.

---

# Phase 2 — Pattern Dependence Analysis

Find all fixed vocabulary, intent patterns, profile-property mappings, platform assumptions, and deterministic planner branches.

Classify each rule as:

## Safety invariant

Examples:

- never submit automatically
- do not infer legal eligibility
- salary fields require explicit salary data
- consent requires explicit authorization

Keep these deterministic.

## Execution invariant

Examples:

- operating a combobox
- uploading a file
- selecting an option
- verifying a field value
- retrying a reversible action

Keep these deterministic.

## Semantic heuristic

Examples:

- interpreting a field as city, country, school, degree, summary, or work eligibility
- selecting a profile property from field wording
- choosing which field or section to complete next

These should normally become evidence for AI, not final decisions.

## Platform-specific workaround

Identify and recommend removal or isolation.

Generate:

- `reports/pattern-dependence-analysis.md`

Report:

- rule counts by category
- semantic decisions currently made without AI
- duplicated intent logic
- fixed mappings becoming an implicit ATS ontology
- areas where adding another pattern is currently the default fix

---

# Phase 3 — AI Context and Decision Contract Assessment

Determine whether the AI receives enough structured context to make reliable decisions.

Check whether the AI receives:

- task goal
- page profile
- current page state
- semantic sections
- field identifiers
- labels and label candidates
- placeholders
- nearby visible text
- control type
- options
- constraints
- supported interaction capabilities
- relevant profile facts
- profile-fact provenance
- completed and unresolved Runtime State
- previous actions
- verification results
- policy boundaries
- safety constraints
- current blockers

Identify information that deterministic code currently collapses too early.

Prefer exposing raw structured evidence such as:

```js
{
  fieldId: "field-17",
  label: "Where are you currently based?",
  placeholder: "City or region",
  section: "Personal details",
  controlType: "combobox",
  optionsPreview: [],
  profileFacts: [
    {
      property: "location.city",
      value: "Wellington",
      provenance: "user-profile"
    },
    {
      property: "location.country",
      value: "New Zealand",
      provenance: "user-profile"
    }
  ]
}
````

instead of deterministically assigning:

```js
{
  intent: "city",
  profileProperty: "location.city"
}
```

Generate:

* `reports/ai-decision-contract-assessment.md`

---

# Phase 4 — Target Architecture

Design four explicit layers.

## Layer A — Deterministic Observation

Responsibilities:

* extract DOM, accessibility, and browser facts
* expose page structure and semantic evidence
* identify interactive elements
* expose supported browser capabilities
* avoid making final semantic decisions

## Layer B — AI Semantic Reasoning

Responsibilities:

* understand the current page goal
* interpret field meaning
* select an explicit profile fact
* decide the next action
* identify ambiguity
* request user review
* propose expected postconditions
* propose recovery after verified failure

## Layer C — Deterministic Decision Gate

Responsibilities:

* validate decision schema
* confirm referenced targets and facts exist
* enforce Field Answer Safety Guard
* enforce policy
* prevent Runtime State contradictions
* reject unsupported or unsafe decisions
* convert rejected decisions into explainable review items

## Layer D — Deterministic Capability Execution

Responsibilities:

* convert approved abstract actions into Playwright operations
* execute reusable browser capabilities
* verify effects
* update Runtime State

Map existing modules to these layers and identify current boundary violations.

---

# Phase 5 — Structured AI Decision Schema

Propose an additive, ATS-independent decision contract.

Example executable decision:

```js
{
  decisionType: "fill-field",
  goal: "Complete the applicant's current city",
  target: {
    elementId: "field-17"
  },
  interpretation: {
    fieldIntent: "current-city",
    confidence: 0.91,
    evidence: [
      {
        source: "label",
        value: "Where are you currently based?"
      },
      {
        source: "placeholder",
        value: "City or region"
      },
      {
        source: "section",
        value: "Personal details"
      }
    ]
  },
  selectedFact: {
    property: "location.city",
    value: "Wellington",
    provenance: "user-profile"
  },
  proposedAction: {
    capability: "select-combobox-option",
    value: "Wellington"
  },
  expectedPostcondition: {
    fieldValueContains: "Wellington"
  },
  uncertainty: {
    level: "low",
    alternatives: [
      "location.region"
    ]
  },
  requiresReview: false
}
```

Example unresolved decision:

```js
{
  decisionType: "request-review",
  target: {
    elementId: "field-22"
  },
  interpretation: {
    fieldIntent: "work-authorization",
    confidence: 0.88,
    evidence: []
  },
  reason: "explicit-country-scoped-answer-not-available",
  questionForUser: "Are you legally authorized to work in New Zealand?",
  requiresReview: true
}
```

The schema must be:

* structured
* auditable
* independent of ATS platforms
* independent of Playwright selectors
* compatible with deterministic safety and policy validation
* able to express evidence, uncertainty, alternatives, and expected postconditions

---

# Phase 6 — Additive Migration Plan

Do not perform a full rewrite.

Propose these migration phases:

## Migration 0 — Decision Provenance

Record whether each decision came from:

* AI
* deterministic semantic rule
* safety guard
* policy
* executor
* recovery logic

Add objective metrics:

* `aiSemanticDecisionCount`
* `deterministicSemanticDecisionCount`
* `safetyOverrideCount`
* `policyOverrideCount`
* `aiDecisionAcceptedCount`
* `aiDecisionRejectedCount`
* `reviewDecisionCount`

## Migration 1 — Shadow AI Decisions

For selected low-risk fields, let AI produce a shadow decision while current logic remains authoritative.

Compare:

* interpreted intent
* selected profile fact
* target
* proposed capability
* expected postcondition

Do not execute shadow decisions.

## Migration 2 — AI-Primary Low-Risk Fields

After evidence shows acceptable reliability, allow AI decisions to become authoritative for:

* name
* email
* phone
* city
* country
* school
* degree

All decisions still pass through deterministic validation and safety gates.

Keep the existing matcher as a fallback and comparison baseline.

## Migration 3 — AI-Primary Planning

Allow AI to decide:

* which unresolved field or section to handle next
* whether to navigate or continue
* whether user review is required
* which recovery goal to attempt after a verified failure

Policy, execution, and verification remain deterministic.

## Migration 4 — Reduce Pattern Authority

Convert semantic patterns from final decision rules into:

* evidence generators
* candidate generators
* safety classifiers
* fallback behavior

Do not remove safety invariants.

---

# Phase 7 — Benchmark Strategy

Design benchmarks that test genuine semantic generalization.

Include fields whose intent is expressed without existing keywords, such as:

* “Which place do you call home?”
* “Where will you be working from?”
* “Are there restrictions on your ability to work here?”
* fields where section context is more informative than the label
* fields with two plausible profile facts
* unfamiliar wording for common application fields

Measure objectively:

* correct target selection
* correct profile-fact selection
* AI decision accepted by the deterministic gate
* verification success
* correct choice to request review
* safety override frequency
* dependence on predefined patterns

Include ablation tests:

1. semantic patterns enabled
2. selected patterns removed
3. AI still receives the same raw structured evidence

The purpose is to determine whether the system generalizes through AI reasoning rather than fixed vocabulary.

---

# Constraints

Do not:

* weaken Field Answer Safety Guard
* allow AI to bypass policy
* allow AI to invent selectors
* allow arbitrary JavaScript execution
* remove deterministic verification
* remove Runtime State
* automatically submit applications
* add ATS-specific logic
* replace objective metrics with subjective LLM scores
* modify production source code during this audit

Keep deterministic control over:

* safety
* policy
* contracts
* execution
* verification
* Runtime State facts
* irreversible actions

Use AI for:

* semantic understanding
* field interpretation
* profile-fact selection
* next-action planning
* ambiguity detection
* recovery proposals

---

# Required Final Report

Return:

1. Current architecture summary
2. Evidence confirming or rejecting architecture drift
3. Decision ownership map
4. Pattern dependence findings
5. Components that should remain deterministic
6. Components that should move toward AI decisions
7. Proposed structured AI context
8. Proposed AI decision contract
9. Additive migration plan
10. Benchmark strategy
11. Risks and mitigations
12. Recommended first implementation phase

Do not implement the refactor until the audit report has been reviewed and approved.
