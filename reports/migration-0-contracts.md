# Migration 0 Contracts

## Observation v2

Observation v2 is raw structured evidence, not final semantic truth.

Required shape:

- `schemaVersion: 2`
- `observationId`
- `observationFingerprint`
- `url`
- `title`
- `taskGoal`
- `pageSummary`
- `semanticSections`
- `headings`
- `observedElements`
- `supportedAbstractCapabilities`
- `runtimeStateSummary`
- `recentHistory`
- `currentBlockers`
- `policySummary`
- `safetySummary`
- `candidateSignals`

Observed elements use opaque `elementId` values and expose labels, placeholders,
nearby bounded text, structural attributes, options, constraints, state, and
supported abstract capabilities. Selectors, locator code, and Playwright code are
not exposed.

## Profile Facts

Profile fact retrieval returns bounded candidates:

- `factId`
- `path`
- `value`
- `valueType`
- `provenance`
- `explicitness`
- `scope`
- `freshness`
- `valuePresent`
- `relevanceScore`

Retrieval does not select a final fact. It can report `noSuitableFactAvailable`.
Derived facts do not satisfy explicit-sensitive-answer requirements by default.

## Decision v2

Decision v2 is a discriminated union:

- `act`
- `request-review`
- `no-action`
- `recovery-proposal`

An `act` proposal includes:

- `decisionId`
- `observationId`
- `observationFingerprint`
- `goal`
- `targetElementId`
- `interpretedPageGoal`
- `interpretedFieldIntent`
- `evidenceReferences`
- `selectedProfileFactId`
- `selectedProfileFact`
- `proposedAbstractCapability`
- `proposedValue`
- `expectedPostcondition`
- `uncertainty`
- `alternativesConsidered`
- `reviewRequirement`

Decision v2 rejects selector, locator, Playwright, JavaScript, code, command, and
evaluate fields.
