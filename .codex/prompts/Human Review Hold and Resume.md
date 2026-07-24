# Human Review Hold and Resume

## Instruction Authority

Before planning or changing code:

1. read `AGENTS.md`
2. read `.codex/prompts/PROJECT_DIRECTION.md` in full
3. evaluate this task against its Development Decision Checklist

`PROJECT_DIRECTION.md` is authoritative. If this task conflicts with it, stop and explain the conflict before modifying code.

## Real-Run Evidence

The production command:

```bash
npm run apply -- https://job-boards.greenhouse.io/released/jobs/7802196003
```

reached a legitimate safety blocker:

```text
status: needs-review
field: Re-Leased: Recruitment Privacy Policy*
reason: explicit current-run authorization required
completed fields: 10 verified
final submission triggered: false
```

Artifact:

```text
logs/apply/run-2026-07-24T02-16-42-470Z/run-artifact.json
```

The safety decision was correct. The product behavior after that decision was not: the command returned, the persistent browser context closed in `finally`, and the user could not authorize, edit, skip, or complete the field and continue the same run.

## Root Cause to Verify

Current production wiring conditionally creates the review provider:

```js
reviewAnswerProvider: process.stdin.isTTY
  ? createCliReviewAnswerProvider()
  : null
```

When stdin is not a TTY:

1. no review provider is installed
2. the controller returns `needs-review`
3. `AgentController.run()` exits its active loop
4. its `finally` block closes the persistent browser context
5. the Node process ends

Confirm this path with a focused regression test before changing behavior. Also verify whether the reported command was launched from a normal interactive terminal or from a non-interactive command runner; the solution must label these cases truthfully.

## Objective

Make `needs-review` an active, resumable product state.

While review is pending:

- keep the Node process alive
- keep the same browser context and application page open
- present the exact review question, options, suggestion, and safety reason
- wait without consuming controller cycles or busy-looping
- accept an explicit user command
- record the response as current-run evidence
- re-observe the live page
- execute or verify the resolved field
- continue from the same run until another blocker or final-submit protection

The expected flow is:

```text
observe
-> safe actions
-> needs-review
-> hold process and browser
-> user answers
-> record current-run evidence
-> re-observe
-> validate
-> execute or verify manual work
-> continue
-> stop before final submission
```

Do not restart the application, relaunch the browser, or repeat already verified fields after review.

## Existing Capability to Preserve

Do not rebuild the review architecture. Inspect and reuse the current implementation:

- review prompt normalization and formatting
- `reviewAnswerProvider`
- run-scoped review answer provenance
- statement fingerprinting for privacy/legal consent
- Accept/Edit/Skip/Manual/Stop controller commands
- completed and skipped field tracking
- re-observation after review
- action validation and verification
- final-submit protection

The missing feature is production wait-channel and browser-lifecycle behavior, not a new decision contract, state machine, provider framework, or safety taxonomy.

## Product Semantics

Use these states consistently:

- `review-pending`: transient active state; the process and browser remain open while waiting
- `needs-review`: terminal result only when the user explicitly stops, the review channel fails, or safe continuation is impossible
- `ready-for-review`: all actionable fields are complete and final submission remains for the user
- `manual-intervention-required`: the user must work in the browser before continuation

`review-pending` should be observable in logs/checkpoints but should not be emitted as the final run result during a healthy interactive wait.

Waiting time must not consume `maxCycles`, trigger recovery, or count as an action failure.

## Review Commands

Preserve the current console interaction:

```text
[A] Accept suggestion
[E] Edit answer
[S] Skip field
[M] Complete manually, then continue
[Q] Stop this run
```

Required behavior:

### Accept

- available only when a concrete suggestion is displayed
- requires explicit confirmation
- records `resolutionMethod: user-confirmed`
- still passes deterministic option, capability, policy, and safety validation

### Edit

- collects the exact answer for this run
- records `resolutionMethod: user-edited`
- rejects an unavailable option or incompatible control value and returns to the same review prompt

### Skip

- marks only the current field skipped
- records `resolutionMethod: skipped`
- does not bypass a required field at final readiness assessment
- continues to other safe fields when possible

### Manual

- instructs the user to change the current field in the open browser
- waits for explicit confirmation that manual work is finished
- re-observes and verifies the actual control state
- records `resolutionMethod: manual` only after verification succeeds
- returns to review when the field is unchanged or invalid

### Stop

- is the only normal review command that ends the active run immediately
- writes a compact checkpoint/final artifact with `status: needs-review` and `reason: stopped-by-user`
- closes the browser cleanly after the user has chosen to stop

EOF, a closed input stream, or an unavailable review channel is not equivalent to user Stop.

## Review Transport

### Interactive terminal

This is the primary product path.

- always install the console review provider when interactive mode is requested
- inject input/output streams so behavior can be tested without relying on global stdin
- keep one well-owned readline lifecycle; avoid leaked listeners or multiple readers on stdin
- do not close the browser while `rl.question()` is pending
- handle `Ctrl+C`, EOF, and stream errors explicitly

Do not use `process.stdin.isTTY ? provider : null` as a silent behavior switch.

An interactive terminal is required for production `apply`. If stdin is not a TTY, fail before reading the profile, creating a run, or opening the browser, and print an actionable message telling the user to run `npm run apply` directly in a terminal.

Do not implement a file handoff, second-terminal response command, HTTP server, WebSocket, queue, or detached browser fallback. A non-interactive command runner cannot provide inline human review and must not start the workflow.

## Browser Lifecycle Ownership

Keep browser ownership explicit:

- the browser/context is owned for the entire active run, including review wait
- `finally` should still guarantee cleanup on completed run, explicit Stop, fatal error, or cancellation
- a healthy `review-pending` wait must remain inside the owned run and must not unwind into cleanup
- do not detach an orphan browser process merely to keep the window visible
- do not serialize Playwright page objects or attempt to resume them in a new Node process

After a response, use the same page when it is still open. If the user navigated or the page changed during review, re-observe and reassess instead of applying the stale field reference.

## Privacy and Consent Rules

For the observed privacy-policy blocker:

- display the exact current statement or a bounded identifying excerpt
- require explicit authorization
- scope authorization to the current run and exact statement fingerprint
- never reuse it across sites, statements, or future runs
- never write it permanently to the profile by default
- never infer acceptance from the user continuing the command

All existing salary, work-eligibility, legal, privacy, declaration, upload, and final-submit safeguards remain deterministic.

## Artifact and Checkpoint Behavior

While waiting, write a compact checkpoint so interruption is diagnosable:

```json
{
  "runId": "run-...",
  "status": "review-pending",
  "fieldFingerprint": "...",
  "fieldLabel": "Re-Leased: Recruitment Privacy Policy*",
  "reason": "legal-consent-requires-user-review",
  "browserHeldOpen": true,
  "finalSubmissionTriggered": false
}
```

After the user responds, record only objective provenance:

- command used
- resolution method
- current-run scope
- field and statement fingerprint
- response timestamp
- verification outcome

Do not persist full privacy statements, unrelated profile facts, secrets, or speculative reasoning.

The final run artifact should be written after the workflow reaches its actual terminal outcome. A pending checkpoint must not be mistaken for a completed run artifact.

## Focused Implementation Plan

### Phase 0 - Reproduce

- add a regression fixture with a normal field followed by a required privacy-consent field and final Submit
- reproduce interactive and non-TTY provider selection paths
- assert non-TTY execution fails before browser launch

### Phase 1 - Hold in Interactive Mode

- remove the silent null-provider branch
- make review transport selection explicit
- keep the provider await inside the active controller/browser lifetime
- handle Accept/Edit/Skip/Manual/Stop and input failures
- prove two sequential review blockers can be resolved in one run

### Phase 2 - Checkpoint and Summary

- expose `review-pending` as a transient checkpoint
- distinguish explicit user Stop from review-channel failure
- emit exactly one actionable instruction while waiting
- preserve compact final artifacts and truthful metrics

### Phase 3 - Real-Run Validation

- rerun the same Greenhouse URL only with explicit user involvement
- stop at the privacy field and confirm the browser remains open
- collect explicit current-run authorization through the selected transport
- verify the privacy field state
- continue to the next blocker or `ready-for-review`
- confirm final Submit is never activated

Do not automatically accept the real privacy policy during validation. The user must provide the authorization.

## Required Tests

Add focused tests for:

- provider selection does not silently become null
- pending review leaves the run Promise unresolved until a response arrives
- browser/context close is not called while review is pending
- Accept resumes and verifies the field
- Edit validates the exact option/value
- Skip continues without falsely completing the field
- Manual requires re-observation and successful verification
- Stop writes the correct result and closes cleanly
- EOF/channel failure is distinguishable from Stop
- two sequential reviews use different fingerprints/nonces
- stale response cannot resolve a new review item
- current-statement consent cannot be reused
- completed fields are not repeated after resume
- wait duration does not consume controller cycles
- final submission remains untouched

Run at minimum:

```bash
npm run test:controller
npm run test:state
npm run test:decision-cycle
npm run test:policy
npm run test:mvp
```

Add any new focused CLI/transport test to `test:mvp`.

## Acceptance Criteria

The change is complete when:

- an interactive `npm run apply -- <job-url>` holds at review and accepts user input
- the same browser context and page remain alive during the wait
- the user response is applied or manually verified, then the run continues
- multiple review blockers can be handled without relaunching
- non-TTY execution fails before browser launch with an explicit terminal requirement
- privacy consent remains exact-statement and current-run scoped
- no completed field is repeated
- no busy loop or orphan browser remains
- interruption and explicit Stop produce truthful artifacts
- all focused and MVP tests pass
- `incorrectFieldEntries = 0`
- `unsafeActionsExecuted = 0`
- `finalSubmissionTriggered = false`

## Non-Goals

Do not:

- weaken privacy or legal review rules
- auto-accept the observed policy
- restart the application after review
- add a new decision/observation schema
- add a generalized workflow engine
- add multi-user or remote review infrastructure
- add a paid API dependency
- use website-specific Greenhouse selectors
- detach the browser and call that resume support
- persist consent to the profile automatically
- submit an application

## Final Report

Return:

1. confirmed root cause and launch environment
2. terminal review behavior and non-TTY startup rejection
3. browser lifecycle changes
4. files and scripts changed
5. test coverage and results
6. artifact/checkpoint behavior
7. real-run result, if explicitly authorized
8. confirmation that privacy authorization remained current-run and statement-scoped
9. confirmation that no final submission occurred
10. remaining limitation and the single next action
