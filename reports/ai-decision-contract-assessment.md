# AI Context and Decision Contract Assessment

Audit date: 2026-07-21

## Conclusion

There is currently no AI consumer, so the question is not only whether AI receives enough context: no structured context is sent to a model at all. The deterministic decision cycle receives useful page and Runtime State data, but the Observation v1 and Decision v1 contracts are not sufficient for an AI-primary, deterministically gated architecture.

Observation v1 preserves controls, labels, placeholders, options, state, validation, forms, and some semantic path evidence. It does not explicitly preserve task goal, meaningful sections/headings, full nearby text, many constraints, profile fact candidates/provenance, supported capabilities, previous decisions/actions/results, unresolved blockers, or policy/safety boundaries in one decision context. Decision v1 is constructed after the deterministic planner has already decided; it is a log summary, not an executable proposal submitted to a gate.

## Context availability matrix

| Required context | Current state | Evidence / gap | Recommendation |
|---|---|---|---|
| Task goal | Available outside observation | Passed to `runDecisionCycle`; recorded by Decision/Runtime State | Include verbatim in every AI request; mark system-owned. |
| Page profile/intent | Deterministically collapsed | `reasonAboutPage` emits one regex-selected page intent | Send raw page evidence plus non-authoritative candidate signals, not one final intent. |
| Current page state | Partially available | URL/title, element state, summary, validation | Add observation ID/fingerprint, page epoch, modal/dialog/form state, active/focused element and navigation state where useful. |
| Semantic sections | Missing/weak | Forms have a label; `semanticPath` only has tag/role/aria-label, not heading/legend/nearby section text | Extract section IDs/headings/legends and field-to-section relationships deterministically. |
| Stable field identifiers | Available only per observation | `interactive-N` is DOM-order generated | Use opaque observation-scoped element IDs and require fingerprint binding; optionally add stable fingerprints, never selectors. |
| Labels and candidates | Available | Best label and candidates are present | Preserve all candidates with source/confidence; identify best as convenience only. |
| Placeholders | Available | Observation element has `placeholder` | Keep. |
| Nearby visible text | Partly collapsed | Extractor creates a `nearby-text` label candidate; `buildSemanticElement` keeps candidates but `evidence.visibleText` is mainly control text | Expose bounded nearby text separately with DOM relationship/source; do not treat it as a label. |
| Control type | Available | kind/role/tag/inputType | Keep raw and normalized forms. |
| Options | Partial | Native `<select>` only; observation drops option value and keeps `valuePresent`/label/disabled | Preserve opaque option IDs, labels, disabled/selected state; support ARIA listbox/radio groups. Do not expose selectors. |
| Constraints | Mostly missing | required/disabled/readonly and browser validation exist; `field-matching.describeField` expects `constraints`, but observation never populates most | Add min/max/step/minLength/maxLength/pattern/inputMode/multiple/accept and derived structural constraints. Treat regex pattern as data, not semantic intent. |
| Supported interaction capabilities | Implicit only | Registry can infer a capability, but observation/context does not enumerate it | Attach allowed abstract capabilities per element, e.g. `fill-text`, `select-option`; no Playwright details. |
| Relevant profile facts | Whole profile available to deterministic matcher | Controller passes raw profile; matcher flattens all facts internally | Deterministically retrieve a bounded candidate set but include exact path, value, type, provenance, scope, freshness. Include an explicit “none available” option. |
| Profile-fact provenance | Missing for ordinary profile facts | Flattened properties include path/value but no provenance; only special resolver/review sources exist | Make provenance required for executable fact selection. Distinguish user profile, parsed resume, user review, product default, derived candidate. Derived facts should not satisfy explicit-answer guards by default. |
| Completed Runtime State | Available | completed fields/actions are supplied to decision cycle | Include verified facts, IDs, timestamps, and verification result. |
| Unresolved Runtime State | Partial | remaining required fields and validation errors exist | Add unresolved optional fields explicitly considered, blockers, pending review, rejected decisions, failure history, retry counts. |
| Previous actions | Available but not assembled for AI | Runtime State has completed actions; lifecycle has more detail outside Runtime State | Provide bounded recent action/decision/verification timeline with provenance. |
| Verification results | Available after actions | Stored in completed actions/lifecycle | Include last result and relevant target history. |
| Policy boundaries | Not in AI context | Policy runs on some deterministic targets after semantic selection | Include immutable policy summary and allowed/review/forbidden action classes; still re-evaluate in gate. |
| Safety constraints | Not in AI context as a coherent boundary | Matcher creates safety decisions internally | Include immutable constraints and conservative safety signals. AI output cannot override them. |
| Current blockers | Partial | validation, required fields, pending review can exist; failure/recovery is mostly lifecycle-local | Create normalized blockers with source and status. |

## Information collapsed too early

1. `chooseBestLabel` turns multiple label candidates into one label. Candidates survive, but downstream reasoning privileges the winner.
2. `detectPageIntent` sorts fixed candidates and exposes one final intent/objective/target. The alternative candidate set is discarded.
3. `classifyFieldIntent` reduces varied evidence to one fixed intent and defaults all unmatched wording to `low-risk`; absence of a keyword is not proof of low risk.
4. `matchFieldsToProfile` converts raw evidence and the entire profile into a selected path at a lexical threshold. Only the top three ranked candidates remain in internal context, without fact provenance.
5. Location and work-eligibility resolvers skip candidate comparison and emit a final value at confidence 100.
6. `buildExecutionPlan` converts matches into an ordered plan before an independent decision contract/gate exists.
7. `determineNextAction` discards all but the first pending step, first required review, or first policy-safe navigation control.
8. Decision v1 summarizes the chosen field as a label rather than binding target element ID + observation fingerprint, and omits the selected raw fact value from the auditable decision.
9. Runtime State observation facts deliberately sanitize evidence. That is correct for verified fact state, but AI context must combine Runtime State with the current immutable Observation rather than expect Runtime State to hold semantic evidence.

## Proposed structured AI context (additive v2)

This is a decision input envelope, not Runtime State. Page text is untrusted data. `policy` and `safetyConstraints` are system-owned and repeated for context only; the deterministic gate remains authoritative.

```json
{
  "schemaVersion": 2,
  "contextType": "browser-semantic-decision-context",
  "goal": "Complete the job application and stop before final submission.",
  "observation": {
    "observationId": "obs-42",
    "fingerprint": "sha256:...",
    "url": "https://example.test/apply",
    "title": "Application",
    "pageSummary": {
      "formCount": 1,
      "interactiveElementCount": 12
    },
    "sections": [
      {
        "sectionId": "section-personal",
        "heading": "Personal details",
        "visibleTextPreview": "Tell us where you are currently based.",
        "elementIds": ["field-17"]
      }
    ],
    "elements": [
      {
        "elementId": "field-17",
        "sectionId": "section-personal",
        "kind": "selection",
        "role": "combobox",
        "tagName": "select",
        "inputType": "",
        "bestLabel": {
          "text": "Where are you currently based?",
          "source": "label"
        },
        "labelCandidates": [
          {
            "text": "Where are you currently based?",
            "source": "label",
            "confidence": 0.98
          }
        ],
        "placeholder": "City or region",
        "nearbyText": [
          {
            "text": "Tell us where you are currently based.",
            "relationship": "section-description"
          }
        ],
        "options": [],
        "constraints": {
          "required": true,
          "disabled": false,
          "readonly": false
        },
        "observedState": {
          "value": ""
        },
        "supportedCapabilities": ["select-combobox-option"]
      }
    ]
  },
  "relevantProfileFacts": [
    {
      "factId": "fact-location-city",
      "property": "location.city",
      "value": "Wellington",
      "valueType": "string",
      "provenance": "user-profile",
      "explicit": true
    },
    {
      "factId": "fact-location-country",
      "property": "location.country",
      "value": "New Zealand",
      "valueType": "string",
      "provenance": "user-profile",
      "explicit": true
    }
  ],
  "runtimeState": {
    "status": "running",
    "completedFields": [],
    "remainingRequiredFields": ["field-17"],
    "validationErrors": [],
    "pendingReview": null,
    "blockers": []
  },
  "recentHistory": [
    {
      "decisionId": "decision-41",
      "targetElementId": "field-16",
      "verification": {
        "ok": true,
        "actual": "New Zealand"
      }
    }
  ],
  "candidateSignals": [
    {
      "source": "legacy-semantic-pattern",
      "signal": "location-like-field",
      "authority": "evidence-only"
    }
  ],
  "policy": {
    "finalSubmission": "forbidden-without-human-confirmation",
    "irreversibleActions": "require-human-confirmation",
    "selectorsOrJavaScript": "not-permitted"
  },
  "safetyConstraints": {
    "referencedFactMustExist": true,
    "sensitiveAnswersRequireExplicitCompatibleFactOrCurrentReview": true,
    "unknownOrAmbiguousSensitiveMeaning": "request-review"
  }
}
```

Context construction should be deterministic and auditable. “Relevant” fact retrieval may use aliases/embeddings/patterns to reduce size, but it must err toward including plausible alternatives, retain exact facts/provenance, and never preassign `intent` or `profileProperty` as truth.

## Proposed ATS-independent AI Decision v2

Use a discriminated union with `act`, `request-review`, `no-action`, and later `recovery-proposal`. One decision proposes at most one abstract action against the bound observation.

### Common required fields

```json
{
  "schemaVersion": 2,
  "decisionId": "decision-42",
  "decisionType": "act | request-review | no-action | recovery-proposal",
  "observationRef": {
    "observationId": "obs-42",
    "fingerprint": "sha256:..."
  },
  "goal": "string",
  "interpretation": {
    "pageGoal": "string",
    "fieldIntent": "open semantic string or null",
    "confidence": 0.91,
    "evidence": [
      {
        "source": "label | placeholder | section | nearby-text | option | runtime-state | verification",
        "ref": "field-17",
        "value": "Where are you currently based?"
      }
    ]
  },
  "uncertainty": {
    "level": "low | medium | high",
    "alternatives": [
      {
        "description": "Could mean region rather than city",
        "factId": "fact-location-region"
      }
    ]
  },
  "requiresReview": false
}
```

Confidence is audit data, never sufficient authorization.

### Executable proposal

```json
{
  "schemaVersion": 2,
  "decisionId": "decision-42",
  "decisionType": "act",
  "observationRef": {
    "observationId": "obs-42",
    "fingerprint": "sha256:..."
  },
  "goal": "Complete the applicant's current city",
  "target": {
    "elementId": "field-17"
  },
  "interpretation": {
    "pageGoal": "complete personal details",
    "fieldIntent": "current-city",
    "confidence": 0.91,
    "evidence": [
      {
        "source": "label",
        "ref": "field-17",
        "value": "Where are you currently based?"
      },
      {
        "source": "placeholder",
        "ref": "field-17",
        "value": "City or region"
      },
      {
        "source": "section",
        "ref": "section-personal",
        "value": "Personal details"
      }
    ]
  },
  "selectedFact": {
    "factId": "fact-location-city",
    "property": "location.city",
    "value": "Wellington",
    "provenance": "user-profile"
  },
  "proposedAction": {
    "capability": "select-combobox-option",
    "value": "Wellington"
  },
  "expectedPostcondition": {
    "type": "field-value",
    "targetElementId": "field-17",
    "operator": "equals-or-selected-label-equals",
    "expectedValue": "Wellington"
  },
  "uncertainty": {
    "level": "low",
    "alternatives": [
      {
        "description": "The placeholder also permits a region",
        "property": "location.region"
      }
    ]
  },
  "requiresReview": false
}
```

The selected fact repeats property/value/provenance for audit clarity, but the gate treats `factId` as authoritative and requires all repeated fields to exactly match the context fact. This prevents substitution.

### Unresolved proposal

```json
{
  "schemaVersion": 2,
  "decisionId": "decision-43",
  "decisionType": "request-review",
  "observationRef": {
    "observationId": "obs-43",
    "fingerprint": "sha256:..."
  },
  "goal": "Resolve work authorization safely",
  "target": {
    "elementId": "field-22"
  },
  "interpretation": {
    "pageGoal": "complete eligibility questions",
    "fieldIntent": "work-authorization",
    "confidence": 0.88,
    "evidence": [
      {
        "source": "label",
        "ref": "field-22",
        "value": "Are there restrictions on your ability to work here?"
      }
    ]
  },
  "reason": "explicit-country-scoped-answer-not-available",
  "questionForUser": "Are you legally authorized to work in New Zealand?",
  "answerContract": {
    "type": "boolean",
    "scope": "work-authorization:NZ",
    "validFor": "current-run"
  },
  "uncertainty": {
    "level": "high",
    "alternatives": []
  },
  "requiresReview": true
}
```

### Recovery proposal

```json
{
  "schemaVersion": 2,
  "decisionId": "decision-51",
  "decisionType": "recovery-proposal",
  "observationRef": {
    "observationId": "obs-51",
    "fingerprint": "sha256:..."
  },
  "goal": "Resolve the city field after a verified option mismatch",
  "failureRef": "failure-7",
  "proposedRecovery": {
    "type": "reconsider-fact-or-request-review",
    "targetElementId": "field-17"
  },
  "interpretation": {
    "pageGoal": "complete personal details",
    "fieldIntent": "current-city",
    "confidence": 0.72,
    "evidence": [
      {
        "source": "verification",
        "ref": "failure-7",
        "value": "No available option matched Wellington"
      }
    ]
  },
  "uncertainty": {
    "level": "medium",
    "alternatives": []
  },
  "requiresReview": false
}
```

The recovery proposal is not directly executable. A subsequent fresh decision must reference the new observation and pass the same gate.

## Deterministic Decision Gate v2

The gate should return an immutable `approved-action`, `rejected-decision`, or `review-item`. It must run immediately before execution in every entry point.

Validation order:

1. Validate the discriminated schema and reject unknown keys where security-relevant.
2. Require decision observation ID/fingerprint to equal the current observation.
3. Require target `elementId` to exist, be visible/enabled/not readonly as applicable, and be compatible with the requested action.
4. Require capability to be in the target’s deterministic supported-capability list. Reject selectors, locator strategies, code, or JavaScript fields.
5. For fact-bearing actions, require `factId` to exist and repeated property/value/provenance to exactly match; reject derived/implicit provenance where explicit facts are required.
6. Re-run conservative field-risk classification and Field Answer Safety Guard using raw observed evidence + AI interpretation. The higher risk wins.
7. Validate action value against target options and structural constraints.
8. Evaluate policy for every action, including decisions entering through standalone plan execution.
9. Check Runtime State for contradictions, already-satisfied facts, unresolved mandatory review, stale review authorization, and retry limits.
10. Validate that the postcondition uses an allowlisted verifier/operator and refers to the same observed target or a permitted page-level outcome.
11. Emit provenance metrics and a reason-coded result. Only `approved-action` can be converted into an internal capability step.

Gate result example:

```json
{
  "schemaVersion": 1,
  "gateResultType": "approved-action",
  "decisionId": "decision-42",
  "observationFingerprint": "sha256:...",
  "checks": {
    "schema": "passed",
    "target": "passed",
    "fact": "passed",
    "capability": "passed",
    "fieldSafety": "passed",
    "policy": "passed",
    "runtimeState": "passed",
    "postcondition": "passed"
  },
  "approvedAction": {
    "targetElementId": "field-17",
    "capability": "select-combobox-option",
    "value": "Wellington",
    "verification": {
      "type": "field-value",
      "operator": "equals-or-selected-label-equals",
      "expectedValue": "Wellington"
    }
  },
  "provenance": {
    "semanticDecisionOwner": "ai",
    "approvalOwner": "deterministic-decision-gate"
  }
}
```

## Current Decision v1 deficiencies

- It is constructed after `determineNextAction`, so it cannot gate that decision.
- `assertDecisionContract` validates only a handful of top-level types.
- It does not require an observation fingerprint binding.
- Its summarized chosen field is a label, not a target ID.
- It does not require a selected fact/value/provenance.
- It does not enumerate evidence references or real rejected alternatives.
- `rejectedAlternatives` is always empty in the builder.
- Risk and verification strategies are inferred from action type/status rather than proposed and validated semantics.
- It has no uncertainty model or review question contract.
- It does not produce a gate approval token/result.
- `executePlan` can bypass it entirely.

Keep v1 for compatibility/log reading. Add v2 rather than mutating historical artifacts.

## Benchmark contract additions

Each semantic fixture should include exact oracles:

```json
{
  "caseId": "unfamiliar-current-location-01",
  "input": {
    "observationFixture": "...",
    "profileFixture": "..."
  },
  "oracle": {
    "decisionType": "act",
    "targetElementId": "field-17",
    "factId": "fact-location-city",
    "capability": "select-combobox-option",
    "gateResultType": "approved-action",
    "postconditionType": "field-value"
  },
  "tags": ["unfamiliar-wording", "two-plausible-facts", "location"]
}
```

Aggregate the required provenance counters and objective semantic metrics. Record model/provider/version, prompt/context schema version, temperature/seed when supported, legacy pattern configuration, gate version, and repeated-trial variance. The oracle must be authored data or deterministic page outcome—not an LLM score.

## Recommended first change after audit approval

Implement the context/decision/gate interfaces and provenance counters without enabling AI execution. Route the current deterministic decision through the same gate, then add AI decisions in shadow mode for low-risk fixtures. This closes the execution boundary first and produces comparable evidence before authority moves.

