# Final Review Browser Hold Lifecycle

## Instruction Authority

Before planning or changing code:

1. read `AGENTS.md`;
2. read `.codex/prompts/PROJECT_DIRECTION.md` in full;
3. inspect the current worktree and preserve unrelated user changes;
4. evaluate every change against the project's zero-cost, local, human-supervised workflow.

`PROJECT_DIRECTION.md` is authoritative. Stop and report any conflict instead of weakening final-submit protection.

## Real-Run Evidence

The production command:

```bash
pnpm apply -- https://job-boards.greenhouse.io/released/jobs/7802196003
```

successfully resolved the field-review checkpoints and reached the final submission boundary:

```text
Status: ready-for-review
Reason: stopped before final submission
Verified fields: 11
Review decisions applied: 3
Skipped fields: 1
Pending review items: 0
Final submission: not triggered
```

Relevant artifact:

```text
logs/apply/run-2026-07-24T14-58-05-848Z/run-artifact.json
```

The run was safe and successful. Location, privacy consent, and salary review answers were applied and verified. The remaining product defect is lifecycle ownership: once `runOnPage()` returns `awaiting-human-confirmation` with reason `final-submission-control-detected`, `AgentController.run()` unwinds through `finally` and closes the Playwright context before the user can inspect the completed form.

Confirm this root cause with a focused failing test before implementation.

## Objective

For an interactive `pnpm apply -- <job-url>` run, hold the live browser open at the final submission boundary so the user can inspect or manually submit the application.

The agent must remain permanently paused during this hold. No CLI decision may authorize or trigger automated final submission.

Preserve current non-interactive behavior: if no interactive final-review provider is available, return `ready-for-review`, write the artifact, close browser resources, and exit without waiting.

## Project-Specific Design Decision

Do not rename the stable external status or add a second workflow engine.

Keep:

```js
result.status === "awaiting-human-confirmation"
result.reason === "final-submission-control-detected"
artifact.status === "ready-for-review"
```

Add only a small final-review lifecycle result:

```js
finalReview: {
  interactive: true,
  state: "manual-review-complete | finished-without-submit | stopped-by-user | browser-closed",
  automatedActionsPerformed: false,
  manualSubmissionOutcome: "unknown"
}
```

Do not add `status: "final-review"` across controller, report, artifact, and benchmark consumers. `ready-for-review` is the application readiness state; `finalReview.state` describes how the interactive browser hold ended.

The existing `REVIEW_TYPES.FINAL_REVIEW` and allowed actions may be reused:

```js
["keep-open", "finish-without-submit", "stop"]
```

However, final review is not a field review. Do not put it through field fingerprints, field-answer safety, option snapshots, `manualReview`, or normal review-answer persistence.

## Correct Ownership Boundary

`AgentController.run()` owns browser/context creation and cleanup. The final-review wait must occur:

```text
open context/page
-> runOnPage()
-> receive exact final-submit-boundary result
-> await optional finalReviewProvider while page/context remain live
-> attach finalReview outcome to result
-> return
-> finally closes context
```

Do not wait in the CLI after `completeJobApplication()` returns; at that point the controller's `finally` has already closed the browser.

Do not make `runOnPage()` itself unconditionally wait. It does not own browser cleanup and is used directly by focused tests and embedded callers. Put the hold in the browser-owning `run()` path or a small private helper called from that path.

Avoid duplicating the hold logic between persistent and non-persistent branches. A small helper such as `maybeHoldForFinalReview({ page, result })` is acceptable.

## Activation Guard

Invoke final review only when all of these are true:

```text
- result.status === awaiting-human-confirmation
- result.reason === final-submission-control-detected
- runtimeState.pendingReviewCheckpoint is absent
- finalReviewProvider is a function
- page and context are still open
```

Do not invoke it for:

- privacy/legal consent review;
- salary or option review;
- login-required;
- recovery-needs-user-confirmation;
- max-cycles-reached;
- generic `needs-review`;
- fatal execution or verification failure.

The existing policy engine and terminal-state detection remain authoritative. Do not add new submit-text matching or ATS-specific selectors.

## Final Review Provider Contract

Keep the provider lifecycle-only and testable:

```js
async function finalReviewProvider({ summary, signal }) {
  // returns one lifecycle decision
}
```

Recommended return values:

```js
{ action: "keep-open" }
{ action: "finish-without-submit" }
{ action: "stop" }
```

Do not pass a Playwright `page`, locator, action executor, or submit capability to the CLI provider. The headed browser is already visible to the user; withholding page action handles makes the no-automation boundary explicit.

Validate provider output against the existing final-review allowed actions. Invalid output should be reprompted by the CLI provider or fail closed; it must never resume the planner.

## Interactive CLI Behavior

Create an injectable CLI final-review provider only when stdin and stdout are interactive TTY streams. Reuse the existing readline conventions and dependency injection used by checkpoint prompts.

Display a bounded summary without field values or sensitive answers:

```text
Application ready for final review

Verified fields: 11
Review decisions applied: 3
Skipped fields: 1
Pending review items: 0

Automation is complete and permanently paused for this run.
Final submission was not triggered.
The browser remains open for manual inspection.

[K] Keep open for manual review/submission
[F] Finish without submitting
[Q] Stop and close browser
```

### Keep Open

After `K`, do not return immediately. Keep the provider promise pending and print:

```text
Manual review mode active.
The agent will perform no further browser actions.
Review or manually submit in the browser, then press Enter here to finish and close.
```

When the user presses Enter, return `{ action: "keep-open" }`. Record:

```js
state: "manual-review-complete"
manualSubmissionOutcome: "unknown"
```

Do not inspect the page after manual ownership begins. Do not infer submission from navigation, URL changes, button disappearance, or page text.

### Finish Without Submitting

`F` returns `{ action: "finish-without-submit" }` immediately. The controller returns normally, its existing `finally` closes the context, and the artifact remains `ready-for-review` with automated submission false.

### Stop

`Q` returns `{ action: "stop" }`. Record `finalReview.state: "stopped-by-user"`, close resources through the existing cleanup path, and preserve the application's `ready-for-review` status. This is a lifecycle exit, not a failed field review.

Do not expose `Submit`, `Accept and submit`, `Continue`, or any equivalent CLI action.

## Cancellation and Cleanup

Use the existing controller `finally` as the single cleanup guarantee. Do not detach or orphan Chromium.

Support cancellation without building a general signal framework:

- EOF or closed stdin ends final review safely without submission;
- `Ctrl+C`/provider abort rejects or returns a stop outcome and allows `finally` to close the context;
- if the final page or context is manually closed, cancel the pending provider and record `browser-closed`;
- close readline exactly once;
- remove temporary listeners when the hold resolves;
- do not busy-loop or consume controller cycles while waiting.

An `AbortController` local to the final-review hold is sufficient if cancellation is needed. Do not create a reusable event bus or browser-session protocol.

## Non-Interactive Behavior

When no TTY final-review provider exists:

```text
final boundary reached
-> no wait
-> preserve ready-for-review result
-> write compact artifact
-> close browser/context
-> exit
```

Do not block CI, piped input, benchmark replay, or scripted runs. Do not change existing field-review transport behavior as part of this task.

## Artifact Semantics

Continue writing the final artifact only after the final-review provider resolves and the agent returns.

Add an optional bounded object:

```js
finalReview: {
  interactive: true,
  state: "manual-review-complete",
  automatedActionsPerformed: false,
  manualSubmissionOutcome: "unknown"
}
```

For non-interactive runs, omit `finalReview` or record `interactive: false` only if that matches current artifact conventions.

Preserve:

```js
status: "ready-for-review"
finalSubmissionTriggered: false
submitted: false
```

In this project, these existing fields describe agent-triggered submission. Manual ownership must not cause `submitted: true`. Do not persist page contents, sensitive review values, or speculative submission evidence.

## CLI Completion Output

The final-review prompt is shown while the browser is open. Print the existing compact `Application run complete` summary only after the user exits final review and cleanup can proceed.

Do not restore full `result` JSON output. Full diagnostics remain in `run-artifact.json`; `APPLY_DEBUG=1` remains the opt-in path for stack traces.

## Focused Implementation Plan

### Phase 0 - Reproduce

- Add a final-submit fixture and an externally controlled final-review provider promise.
- Prove the current browser-owning `run()` returns and closes the context immediately.
- Do not use sleep-only assertions; coordinate with promises/events.

### Phase 1 - Browser-Owned Hold

- Add the optional provider to `AgentController` options.
- Await it after the exact final-boundary result and before context cleanup.
- Ensure no planner, executor, verifier, or recovery call runs after final review starts.
- Attach the bounded lifecycle outcome to the result.

### Phase 2 - CLI Provider and Artifact

- Add the injectable TTY provider with `K/F/Q` handling.
- Wire it through `BrowserAIAgent` to `AgentController` using existing options flow.
- Add the bounded `finalReview` artifact summary.
- Preserve the compact completion output.

### Phase 3 - Validation

- Run focused controller, CLI, artifact/report, and final-submit policy tests.
- Run `pnpm test:mvp`.
- Perform a guarded live run only with the user present because privacy, salary, and manual submission decisions cannot be automated by the test harness.

Live Greenhouse validation is best effort. Network, job closure, CAPTCHA, or page changes must be reported but must not invalidate passing deterministic tests.

## Required Tests

Add focused coverage for:

1. Exact activation: only `awaiting-human-confirmation` plus `final-submission-control-detected` enters final review.
2. Pending hold: the controller `run()` promise remains pending and the page/context remain open until the provider resolves.
3. Keep Open: no planner/executor activity resumes; manual mode remains pending until acknowledgement; no automated submit occurs.
4. Finish Without Submitting: provider resolves, context closes, status remains artifact-compatible, and submission flags remain false.
5. Stop: cleanup occurs and final review records `stopped-by-user` without converting the application into a field-review failure.
6. Non-TTY/no provider: no wait occurs and the current safe exit behavior remains.
7. Provider cancellation/EOF: no leaked readline or Playwright process.
8. Browser/page close: pending input is cancelled safely.
9. Regression: normal batched field checkpoints still resolve and resume before final review.
10. Safety: no allowed final-review action maps to `click`, `submit`, `press Enter` on the page, or any executor capability.
11. Artifact: bounded `finalReview` metadata is recorded without sensitive values or speculative manual-submission claims.
12. CLI: final-review output is bounded and the compact completion summary appears only after exit.

Run at minimum:

```bash
pnpm test:controller
pnpm test:apply-cli
pnpm test:policy
pnpm test:state
pnpm test:mvp
```

Add any new focused test command to `test:mvp` only if a new test file is introduced.

## Safety Invariants

These must remain true in every branch:

```text
incorrect field entries = 0
automated final submission = false
finalSubmissionTriggered = false
```

- Final review never re-enters the autonomous loop.
- No final-review command becomes an executor step.
- Manual browser interaction is user-owned and not verified or undone by the agent.
- Existing privacy, consent, salary, work-eligibility, upload, and final-submit safeguards remain deterministic.

## Non-Goals

Do not:

- automate final submission;
- add submission polling or success inference;
- add ATS-specific selectors;
- add a generic workflow/state-machine framework;
- detach the browser into an orphan process;
- add a second application runner;
- redesign field-review classifications;
- persist legal consent beyond the current run;
- modify the user profile;
- add remote review infrastructure or a paid API dependency;
- refactor unrelated controller, artifact, or benchmark code.

## Acceptance Criteria

The task is complete when:

- resolving all blocking review items reaches the existing final boundary normally;
- an interactive apply run waits before `AgentController.run()` closes the context;
- the browser remains available throughout final review;
- the CLI states clearly that automation is permanently paused;
- `K` supports manual browser ownership until explicit terminal acknowledgement;
- `F` and `Q` close resources through the owned cleanup path;
- no final-review action can trigger an automated page action;
- non-interactive runs do not wait;
- artifacts remain `ready-for-review` compatible and do not infer manual submission;
- ordinary checkpoint resume behavior is unchanged;
- focused tests and `pnpm test:mvp` pass;
- no Node, Chromium, or readline process/handle remains after exit.

## Final Report

Return:

1. confirmed root cause and lifecycle ownership boundary;
2. exact interactive and non-interactive behavior;
3. files changed;
4. final-review state/artifact semantics;
5. focused and MVP test results;
6. guarded live-run result or concrete external blocker;
7. confirmation that the agent never triggered final submission;
8. remaining limitations, especially that manual submission outcome is intentionally unknown.
