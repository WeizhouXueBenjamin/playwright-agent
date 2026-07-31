# Custom Select Option Discovery and Numeric Review

## Instruction Authority

Before planning or changing code:

1. read `AGENTS.md`
2. read `.codex/prompts/PROJECT_DIRECTION.md` in full
3. evaluate the proposed work against its Development Decision Checklist

`PROJECT_DIRECTION.md` is authoritative. If this task conflicts with it, stop and explain the conflict before modifying code.

## Real-Run Evidence

The production workflow reached this required field:

```text
Re-Leased: Recruitment Privacy Policy*
```

The page uses a custom dropdown with one meaningful option:

```text
Acknowledge/Confirm
```

The terminal review did not show this option. `Accept` was unavailable because there was no profile suggestion, and entering the exact option label through `Edit` did not create valid current-statement consent.

Current implementation limitations to verify:

- option collection only reads native `<select>` elements
- custom `role="combobox"` and `role="listbox"` controls have no associated option snapshot
- custom selection state is not reliably captured or verified
- legal/privacy authorization is conflated with the selected option string
- field fingerprints include mutable options and may change when a dropdown opens

## Decision

Implement deterministic option discovery followed by numbered terminal selection.

Do not ask Codex to enumerate browser options or authorize legal/privacy consent. Browser observation owns available options; the user owns the selection and authorization. Codex is an optional semantic advisor only when supplied options are genuinely ambiguous.

This must be a generic control capability. Do not add Greenhouse selectors, ATS branches, option-text special cases, or a list of consent phrases.

## Objective

For any supported selection control that requires human review:

```text
identify control
-> inspect available options without selecting one
-> display every discovered enabled option with a stable number for this prompt
-> accept a numeric terminal choice
-> obtain separate consent authorization when required
-> revalidate the chosen option against the live control
-> select it
-> verify the selected state
-> continue the same application run
```

Expected terminal experience:

```text
Review required:
Re-Leased: Recruitment Privacy Policy*

Available options:
[1] Acknowledge/Confirm

Enter an option number, or choose:
[R] Refresh options  [M] Manual  [S] Skip  [Q] Quit
> 1

This is a privacy/legal authorization for the exact current statement.
Authorize selecting "Acknowledge/Confirm" for this run? [y/N] y
```

After `y`, the agent selects and verifies the option, then continues. A numeric choice without the explicit legal/privacy confirmation must not execute the selection.

## Scope

Support:

- native `<select>` controls
- ARIA `role="combobox"`
- ARIA `role="listbox"`
- listboxes rendered in a portal outside the field container
- options that appear only after expansion
- disabled and placeholder options
- one-option and multi-option controls
- bounded virtualized/lazy-loaded lists when completeness can be established safely

Do not add:

- arbitrary page JavaScript supplied by Codex
- website-specific selectors
- a new observation or decision schema version
- a generalized UI automation framework
- automatic privacy/legal acceptance
- free-text fallback for a selection control when available options are known

## Product Principles

### Browser evidence is authoritative

Only options observed from the live control may be offered or executed. Profile data, Codex output, aliases, and previous runs cannot invent an option.

### Numbers are prompt-local

`1`, `2`, `3`, and so on are temporary indexes for one exact option snapshot. Persist and execute the option identity, label, and value where available; never persist the numeric index as semantic truth.

### Selection and authorization are separate

For ordinary fields, choosing a number is an explicit answer.

For privacy, consent, declaration, or other legal fields:

1. the number chooses the browser option
2. a separate `y/N` prompt authorizes applying that option to the exact current statement

### Observation before semantics

Codex may help interpret observed choices, but it cannot replace option discovery, deterministic validation, user authorization, execution, or verification.

## Phase 0 - Reproduce With Generic Fixtures

Add local fixtures for:

- native select with one enabled option
- native select with placeholder and multiple options
- custom combobox with inline listbox
- custom combobox whose listbox is rendered in a portal
- custom combobox with options created only after click
- disabled option mixed with enabled options
- duplicate labels with distinct values or context
- a required privacy field with one acknowledgement option
- a custom combobox whose selected value is exposed through `aria-selected`, visible control text, and/or a linked input
- a bounded virtualized list fixture

Reproduce these current failures before implementation:

- custom options are absent from the review prompt
- manual custom selection cannot be verified
- entering an option label as free text is treated as consent authorization
- expanding a control can change its field fingerprint

Do not use the real Greenhouse page as the primary development fixture.

## Phase 1 - Stable Selection Control Identity

Separate three identities.

### Field fingerprint

Represents the stable control identity. Use stable evidence such as:

- DOM/accessibility ID when available
- control role and kind
- label and section context
- name or `aria-labelledby`

Do not include:

- available options
- current selected value
- expanded/collapsed state
- transient DOM index

### Option snapshot identity

Represents one observation of available options:

```js
{
  snapshotId: "...",
  fieldFingerprint: "...",
  observedAt: "...",
  complete: true,
  options: [
    {
      optionId: "...",
      label: "Acknowledge/Confirm",
      value: "acknowledge",
      disabled: false
    }
  ]
}
```

`optionId` should use stable browser evidence when available. Do not derive identity from terminal index alone.

### Statement fingerprint

For privacy/legal fields, fingerprint the exact statement independently from the field and options. Use bounded normalized evidence such as:

- statement text or identifying excerpt
- linked policy URL
- field label and section context

Opening the dropdown or discovering options must not change the statement fingerprint.

Acceptance:

- the same collapsed and expanded control has the same field fingerprint
- changing available options changes the snapshot, not field identity
- a different legal statement has a different statement fingerprint

## Phase 2 - Safe Option Inspection

Add one bounded, reversible operation for selection controls, such as `inspect-options`. It gathers browser evidence and must not select an option.

### Native select

Read all native options without clicking:

- label/text
- value when safe to expose internally
- disabled state
- placeholder/empty-option status
- currently selected state

### ARIA combobox/listbox

Use semantic relationships in this order where available:

1. `aria-controls`
2. `aria-owns`
3. `aria-activedescendant`
4. associated visible `role="listbox"`
5. bounded nearby/portal listbox association using accessibility labels and active expanded state

Inspection flow:

```text
locate the exact current control
-> verify it is visible, enabled, and a supported selection control
-> click only to expand
-> wait for expanded/listbox state with a bounded timeout
-> collect associated role=option elements
-> record label, value/evidence, disabled, selected state
-> press Escape or otherwise collapse without selecting when safe
-> re-observe
```

Do not collect every global `role="option"` on the page without proving association to the active control.

### Virtualized or lazy-loaded options

Attempt bounded collection by scrolling the associated listbox and deduplicating options until:

- the option set and scroll position stabilize, or
- an explicit end is observed

Set `complete: true` only when completeness is established. Enforce maximum iterations and option count. If completeness cannot be established, report that the list is partial and require Manual/Refresh/Quit rather than claiming all options were shown.

Acceptance:

- inspection never changes the selected value
- placeholder and disabled options are identified but cannot be chosen
- unrelated listboxes are not mixed into the snapshot
- the original page remains usable after inspection

## Phase 3 - Numbered Terminal Review

When a field is a supported selection control and review is required, use a specialized option prompt instead of free-text Edit.

Example:

```text
Review required:
What is your current visa type?

Available options:
[1] Citizen
[2] Permanent Resident
[3] Work Visa
[4] Other

Enter an option number, or:
[R] Refresh options  [M] Manual  [S] Skip  [Q] Quit
> 3
```

Requirements:

- display every enabled option discovered in the complete snapshot
- preserve page order
- clearly mark disabled options but do not assign selectable numbers to them
- filter placeholder options such as `Select...` from selectable choices
- accept positive base-10 integers only
- reject zero, negatives, decimals, text labels, and out-of-range values
- on invalid input, explain the valid range and prompt again
- map the number to the exact snapshot option
- revalidate the snapshot before browser execution

For large complete lists, paginate terminal display without hiding options. Use global option numbers across pages and provide navigation commands. The user must be able to inspect every discovered option before selection.

`R` performs a fresh safe inspection and replaces the option snapshot. Any previous number becomes invalid.

`M`, `S`, and `Q` preserve the existing review semantics.

Do not show `Accept` when there is no suggestion. Do not show free-text `Edit` for a selection control with a complete option snapshot.

## Phase 4 - Explicit Sensitive Authorization

After a numeric selection for privacy/legal/consent/declaration fields, display:

```text
Selected option:
Acknowledge/Confirm

This selection authorizes the exact current privacy statement for this run only.
Authorize this selection? [y/N]
```

Only `y` or `yes` creates authorization. Any other input returns to the numbered option prompt without executing.

Store separate facts:

```js
{
  selectedOption: {
    optionId: "...",
    label: "Acknowledge/Confirm",
    value: "acknowledge"
  },
  authorization: {
    authorizationType: "consent",
    authorized: true,
    consentScope: "privacy-policy",
    statementFingerprint: "...",
    scope: "current-run",
    authorizedAt: "...",
    source: "explicit-user-review"
  }
}
```

Do not infer authorization from option wording such as `Acknowledge`, `Confirm`, `Agree`, or `Accept`. Do not add these strings to an authorization regex.

The selected option must still pass option existence, control capability, policy, and statement-fingerprint validation.

## Phase 5 - Generic Custom Option Execution

Extend selection execution without platform-specific code.

### Native select

Continue using `selectOption()` with an exact validated value/label.

### Custom combobox/listbox

Execution flow:

```text
re-locate current control
-> confirm field fingerprint
-> expand control
-> locate its associated listbox
-> find the exact live option by validated identity/label
-> reject zero or multiple ambiguous matches
-> click the exact option
-> wait for stable state
-> re-observe
```

Prefer Playwright semantic locators such as role and exact accessible name within the associated listbox. Do not use generated CSS/XPath or DOM indexes as the primary locator.

If the option disappeared, changed, or became disabled, return to numbered review with a fresh snapshot. Do not select the option currently occupying the old numeric position.

## Phase 6 - Verification

Verify custom selection using objective browser evidence. Support evidence such as:

- control text/value reflects the selected label
- linked input value changed
- selected option has `aria-selected="true"`
- `aria-activedescendant` points to the selected option when the widget uses it as selected state
- placeholder is no longer displayed
- native form validity passes when available

Require evidence tied to the same field and selected option. Do not mark success merely because the option click completed.

When verification fails:

1. re-observe once
2. retry the reversible selection once if the same option still exists
3. return to numbered review or Manual

Never continue with an unverified required selection.

## Codex Boundary

Codex is not required for one-option controls or direct numeric user selection.

Codex may be invoked only when semantic assistance is useful, using a bounded input:

```json
{
  "field": {
    "label": "Current immigration status",
    "section": "Eligibility"
  },
  "availableOptions": [
    { "optionId": "1", "label": "Citizen" },
    { "optionId": "2", "label": "Permanent Resident" },
    { "optionId": "3", "label": "Work Visa" }
  ],
  "candidateFacts": [
    { "path": "workEligibility.visaType", "value": "Post Study Work Visa" }
  ]
}
```

Codex may return:

```json
{
  "candidateOptionId": "3",
  "reason": "The explicit visa type is compatible with Work Visa.",
  "requiresReview": false
}
```

Deterministic code must still validate the option against the current snapshot and live browser. For legal/privacy fields, force `requiresReview: true` regardless of Codex output. Codex must never create consent authorization.

Do not block this feature on Codex availability. Numbered user selection is the complete fallback.

## Runtime State and Artifact

Keep runtime additions factual and bounded. Record:

- stable field fingerprint
- option snapshot ID and completeness
- selected option identity and bounded label
- resolution method (`user-confirmed`, `manual`, or `codex-semantic` where allowed)
- statement fingerprint for sensitive consent
- verification outcome
- whether options were refreshed

Do not store:

- terminal numeric index as persistent meaning
- full page text
- speculative reasoning
- broad reusable consent

## Required Tests

Add focused tests for:

- native options are fully collected without interaction
- custom inline listbox options are collected after safe expansion
- portal listbox is associated with the correct combobox
- unrelated global options are excluded
- inspection does not change selection
- disabled and placeholder options cannot be chosen
- terminal displays all discovered enabled options with stable prompt-local numbers
- `1`, `2`, `3` map to the correct snapshot options
- invalid numbers and text re-prompt
- Refresh invalidates the old snapshot
- large lists can be fully inspected through pagination
- incomplete virtualized lists are labeled incomplete and not misrepresented
- collapsed and expanded field fingerprints are identical
- option changes do not change field identity
- privacy option selection requires a separate `y`
- option wording alone never creates consent
- statement authorization cannot be reused for a different statement
- custom option execution uses the associated listbox and exact option
- stale/changed option snapshots return to review
- custom selected state is verified
- failed verification retries once, then returns to review
- completed fields are not repeated
- final Submit is never activated

Add the focused suites to `pnpm test:mvp`.

Run at minimum:

```bash
pnpm test:controller
pnpm test:field-matching
pnpm test:decision-cycle
pnpm test:decision-gate
pnpm test:policy
pnpm test:state
pnpm test:executor
pnpm test:apply-cli
pnpm test:mvp
```

## Real-Run Validation

After offline tests pass, rerun the same Greenhouse application only with the user present.

Expected flow:

1. agent reaches `Re-Leased: Recruitment Privacy Policy*`
2. agent safely expands the custom dropdown
3. terminal displays `[1] Acknowledge/Confirm`
4. user enters `1`
5. terminal requests explicit current-statement authorization
6. user explicitly confirms
7. agent selects the live option
8. selected state is verified
9. workflow continues to the next blocker or `ready-for-review`
10. final Submit is never activated

Do not automatically provide the real authorization during validation. The user must type the option number and confirmation.

## Acceptance Criteria

The change is complete when:

- native and supported custom selection controls expose truthful option snapshots
- every discovered enabled option can be inspected and selected by terminal number
- numeric indexes are prompt-local and stale snapshots cannot execute
- one-option controls work without Codex
- privacy/legal selection and authorization remain separate
- custom selected state is objectively verified
- Manual remains available when option completeness or verification cannot be established
- no ATS-specific selectors or option regexes are added
- field and statement fingerprints remain stable for their intended identities
- focused tests and `test:mvp` pass
- the real Greenhouse field can be resolved with explicit user authorization
- `incorrectFieldEntries = 0`
- `unsafeActionsExecuted = 0`
- `finalSubmissionTriggered = false`

## Final Report

Return:

1. baseline failures reproduced
2. option discovery methods implemented
3. field, option-snapshot, and statement identity changes
4. terminal numeric review behavior
5. privacy/legal authorization behavior
6. native and custom execution/verification behavior
7. files and scripts changed
8. focused and MVP test results
9. real-run result, if explicitly authorized
10. confirmation that no final submission occurred
11. remaining unsupported selection patterns and the next action
