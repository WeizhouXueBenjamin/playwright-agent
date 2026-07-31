# Commit 1 Option Matcher Safety Fixes

## Authority

Before changing code:

1. read `AGENTS.md`
2. read `.codex/prompts/PROJECT_DIRECTION.md`
3. read `.codex/prompts/Controlled Option Matching and Review.md`, especially Commit 1
4. inspect staged and unstaged changes; preserve unrelated user work

`PROJECT_DIRECTION.md` is authoritative. Preserve:

```text
incorrect field entries = 0
final submission = false
```

Do not create a Git commit unless explicitly requested.

## Objective

Finish the safety boundary of the existing Commit 1 option-matcher implementation without expanding into Commit 2.

The current implementation already has:

- a pure option resolver
- canonical normalization
- native and custom controls using the resolver
- token similarity returning Review candidates only
- the target Work Eligibility case passing
- focused and MVP tests passing

It is not ready because controlled equivalence is too broad, sensitive conflicts are incomplete, and verification reuses semantic matching.

## Confirmed Failures

The current global prefix rule incorrectly returns `matched` for:

```text
Computer Science
-> Computer Science and Engineering

65
-> 65 - 75k

100
-> 100 USD
```

Sensitive-field conflicts also incorrectly return `matched`:

```text
Work Visa
-> Work Visa - Sponsorship required

Citizen or Permanent Resident Visa
-> Citizen or Permanent Resident - Sponsorship required
```

Root causes to verify in code:

- global `candidate.startsWith(expected)` structural equivalence
- generic structural matching runs before Work Eligibility policy
- `sponsorshipRequired` is parsed but not enforced
- verification calls the semantic option resolver again

## Strict Scope

Fix only:

1. automatic matching boundaries
2. sensitive Work Eligibility conflict checks
3. strict post-action verification evidence
4. focused regression tests

Do not implement:

- snapshot stability windows
- typed Review/checkpoint integration
- artifact changes
- replay fixtures
- live-site validation
- new runtime-state fields
- ATS-specific selectors
- a visa or legal-status ontology
- token-similarity execution
- unrelated cleanup or refactoring

## Required Matching Order

Use this order:

```text
normalize observed options
-> canonical exact candidate discovery
-> identify field risk/policy
-> derive policy-permitted structural rules
-> run conflicts
-> controlled equivalence
-> token ranking for Review only
```

A canonical candidate is not permission to execute. Existing decision-gate and sensitive-field policy checks must still run.

## 1. Remove Global Prefix Equivalence

Delete any generic rule equivalent to:

```js
candidate.startsWith(expected)
```

Do not replace it with another generic containment or substring rule.

Automatic controlled equivalence must come only from explicit, bounded helpers such as:

```js
dialCodeSuffixMatch(...)
locationContextSuffixMatch(...)
workEligibilityControlledDescriptorMatch(...)
```

`leadingArticleMatch` may remain part of canonical normalization when removing `The` makes the entire remaining label equal.

Each controlled rule must have:

- required field or selection context
- a narrow allowed transformation
- one positive test
- at least one negative test

### Dial Code Rule

Allow:

```text
New Zealand
-> New Zealand +64
```

only when context identifies a country/phone-country control and the suffix has the expected dial-code structure. Do not treat arbitrary extra text as a dial code.

### Location Rule

Allow:

```text
Auckland
-> Auckland, Auckland Region, New Zealand
```

only when structured location context uniquely confirms the candidate, such as `country: New Zealand`.

Do not allow a context-free city prefix match.

### Ordinary Unknown Suffixes

Ordinary fields may ignore only explicitly registered display structure. They must not accept arbitrary added semantic text.

Therefore:

```text
Computer Science
-> Computer Science and Engineering
```

must not auto-match.

## 2. Sensitive Fields Must Use Policy First

For Work Eligibility, no generic structural helper may return `matched` before sensitive conflict checks.

Keep the initial semantic model small:

```js
{
  citizen: true | false,
  permanentResident: true | false,
  temporaryWorkRights: true | false,
  sponsorshipRequired: true | false | null,
  negated: true | false
}
```

Derive dimensions only from explicit profile facts already supported by the project. Do not infer:

- work rights from location or nationality
- sponsorship from visa type
- visa type from sponsorship
- unknown visa categories from keyword similarity

The profile currently has separate explicit facts such as `workAuthorization` and `requiresSponsorship`. Pass only the minimum safe policy context needed by the matcher. Do not persist raw sensitive values in runtime state or artifacts.

### Sponsorship Three-State Rule

Preserve three states:

```text
true | false | null
```

Required behavior:

- expected `false`, candidate `true` -> conflict
- expected `true`, candidate `false` -> conflict
- expected `null`, candidate mentions sponsorship -> Review/no automatic match
- absence of a sponsorship fact must not be interpreted as `false`

### Unknown Additional Status

For sensitive fields, controlled equivalence may remove only explicitly allowed low-information descriptors.

After that transformation, any remaining candidate text that may alter legal/status meaning must prevent automatic selection.

Example:

```text
Citizen or Permanent Resident
-> Citizen or Permanent Resident - conditions apply
```

Return a non-matched result suitable for Review, with a reason such as:

```text
unknown-additional-status
```

Do not build a list of every visa or legal phrase. Implement this by allowing only narrowly defined transformations; unexplained residual tokens remain unresolved.

### Target Case

This case must continue to match through Work Eligibility controlled equivalence:

```text
explicit workAuthorization = New Zealand Permanent Resident visa
proposed value = Citizen or Permanent Resident Visa
live option = Citizen or Permanent Resident
```

Conditions:

- explicit compatible source exists
- removal is limited to the permitted trailing descriptor
- exactly one candidate remains
- sponsorship does not conflict
- no unknown additional status remains

## 3. Make Verification Strict

Candidate resolution and verification are separate responsibilities:

```text
resolver chooses an exact observed option
executor clicks/selects that option
verifier proves that exact option is selected
```

Do not call the semantic option resolver from verification.

Execution should return available exact evidence:

```js
{
  selectedOptionLabel,
  selectedOptionValue,
  selectedOptionId
}
```

Use only evidence supported by the control:

- native select: exact selected value and selected option label
- custom select: exact selected label/value or `aria-selected` state
- selected option ID only when present and stable
- existing explicit display transformation, such as a dial code, only when tied to the exact clicked option

Do not verify through:

- token similarity
- semantic re-resolution
- generic prefix/substring matching

If the observed selected option differs from the exact option selected by the executor, verification must fail.

## 4. Focused Tests

Add direct matcher tests for all of the following.

### Must Match

```text
Citizen or Permanent Resident Visa
-> Citizen or Permanent Resident

New Zealand
-> New Zealand +64
with country/phone-country context

Auckland
-> Auckland, Auckland Region, New Zealand
with country = New Zealand

University of Auckland
-> The University of Auckland
```

### Must Not Auto-Match

```text
Computer Science
-> Computer Science and Engineering

65
-> 65 - 75k

100
-> 100 USD

New Zealand
-> New Zealand citizen

Auckland
-> Auckland, California, United States
when country = New Zealand

Citizen or Permanent Resident Visa
-> Citizen

Permanent Resident Visa
-> Temporary Work Visa

Authorized to work
-> Not authorized to work

Work Visa
-> Work Visa - Sponsorship required
when requiresSponsorship = false

Citizen or Permanent Resident Visa
-> Citizen or Permanent Resident - conditions apply
```

For non-matches, assert the exact expected status/tier/reason where stable. Avoid weak assertions that only check `status !== matched`.

### Verification Tests

Add tests proving:

- exact clicked native option verifies successfully
- exact clicked custom option verifies successfully
- dial-code display transformation verifies only against its exact clicked option
- a different option with an expected-text prefix fails verification
- similarity alone cannot pass verification

## Validation

Run:

```bash
pnpm test:option-resolver
pnpm test:field-matching
pnpm test:executor
pnpm test:controller
pnpm test:mvp
```

Also run:

```bash
git diff --check
```

Do not run the live Greenhouse application as part of this repair prompt.

## Acceptance Criteria

Commit 1 is ready only when:

- no generic prefix/substring equivalence remains
- every automatic structural match is explicitly bounded by context
- the target Work Eligibility case still resolves automatically
- sponsorship conflict and unknown sensitive suffixes cannot auto-match
- absent sponsorship information remains `null`, not `false`
- token similarity cannot auto-select any field
- verification does not call semantic option resolution
- verification checks exact execution evidence
- all listed positive and negative tests exist and pass
- full MVP regression passes
- no Commit 2 behavior was introduced
- final-submit protection is unchanged

## Final Report

Report:

1. root causes fixed
2. exact controlled-equivalence rules that remain
3. Work Eligibility conflict behavior
4. verification evidence used for native and custom controls
5. files changed
6. tests run and results
7. confirmation that Commit 2 scope was not entered
8. any remaining issue that should block committing Commit 1
