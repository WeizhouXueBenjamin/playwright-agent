# Streamlined Interactive Application UX

Before changing code, read `AGENTS.md` and `.codex/prompts/PROJECT_DIRECTION.md`.
Preserve unrelated worktree changes. If this task conflicts with project direction, stop and report the conflict.

## Goal

Optimize `pnpm apply -- <job-url>` for personal daily use.

Priority:

```text
simplicity > convenience > extensibility
```

Keep existing safety behavior. Reduce only redundant CLI interaction and output.

Do not redesign the workflow.

## Required Changes

### 1. One decision, one input

After a valid user decision, continue automatically.

Remove:

* `Review decisions` summary;
* `[R] Resume application`;
* second `y/N` confirmation after explicit consent authorization;
* `[I] Input value` before entering a manual value;
* `[K] Keep open` before normal final review.

Do not replace them with other confirmations.

### 2. Direct review input

Use simple prompts.

Option:

```text
Location

1. Auckland, Auckland Region, New Zealand
2. Auckland Airport, Auckland Region, New Zealand
3. Auckland Central, Auckland Region, New Zealand

> 1
```

Consent:

```text
Privacy Policy

[A] Authorize
[D] Decline
>
```

`A` is the explicit current-run authorization. Do not ask again.

The prompt must identify the exact current statement and selected option. Preserve existing statement fingerprinting and current-run provenance.

Manual value:

```text
Salary expectation

> 65-75k
```

Non-empty text is the value.

Keep Manual/Skip/Quit only where they are already useful. Do not build a new command system.

### 3. Automatically resume batches

Internally keep the existing checkpoint batching.

After the last valid decision:

```text
Continuing application...
```

Then immediately return control to the existing controller.

No batch confirmation.

### 4. Make final review the default

When the final submission boundary is reached, immediately keep the browser open:

```text
Ready for final review

Browser is open.
The agent is paused and will not submit.

Review or submit manually, then press Enter to finish.
```

Do not first ask whether to keep the browser open.

Enter ends the session.

Ctrl+C may use existing stop/cleanup behavior.

Do not automate or infer manual submission.

### 5. Keep normal output minimal

Normal output should contain only:

* meaningful progress;
* questions requiring user input;
* actionable errors;
* final review;
* final completion.

Do not normally print:

* review type names;
* reason codes;
* match tiers;
* candidate scores;
* checkpoint IDs;
* field fingerprints;
* internal state;
* full result JSON.

Keep detailed evidence in `run-artifact.json`.

Existing `APPLY_DEBUG=1` may continue to expose useful diagnostics. Do not build a new debug framework.

## Scope

Prefer changing only the existing CLI/review presentation code.

Do not modify unless strictly necessary:

* planner;
* policy;
* field safety;
* option resolver;
* controller validation;
* executor;
* verifier;
* provenance;
* final-submit detection.

Do not add:

* new state machines;
* UI frameworks;
* command-router abstractions;
* localization systems;
* new generic prompt schemas;
* new browser protocols.

Reuse current typed decisions and review contracts.

## Safety

Preserve:

```text
incorrect field entries = 0
automatic final submission = false
finalSubmissionTriggered = false
```

Do not weaken:

* legal/privacy authorization;
* salary safeguards;
* work-eligibility safeguards;
* current-run-only review answers;
* verification;
* final-submit blocking.

Reducing confirmations must not reduce internal validation.

## Tests

Update only focused tests necessary to prove:

1. completed review batches resume without `R`;
2. consent authorization requires only one explicit input;
3. manual values can be entered directly;
4. option selection still works;
5. final review opens immediately and waits for the user;
6. non-interactive runs remain non-blocking;
7. no automated final submission path exists.

Then run:

```bash
pnpm test:apply-cli
pnpm test:controller
pnpm test:mvp
```

Run additional existing tests only when touched code requires them.

Do not create a large UX test matrix.

## Implementation Principle

This is a personal-use tool.

Prefer the smallest change that removes observed friction.

Do not implement features merely because they may be useful later.

If a convenience feature requires new policy, state, abstractions, or a substantial test matrix, leave it out unless it fixes a demonstrated current problem.

## Expected UX

Target:

```text
Opening application...

Location

1. Auckland, Auckland Region, New Zealand
2. Auckland Airport, Auckland Region, New Zealand
3. Auckland Central, Auckland Region, New Zealand
> 1

Continuing application...

2 items need your input

1/2 Privacy Policy
[A] Authorize
[D] Decline
> a

2/2 Salary expectation
> 65-75k

Continuing application...

Ready for final review

Browser is open.
The agent is paused and will not submit.

Review or submit manually, then press Enter to finish.
```

Avoid adding anything beyond what is needed to reach this workflow.
