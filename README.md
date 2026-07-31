# Personal Job Application Assistant

A local, personal job application assistant built with Node.js, Playwright and Codex, that helps complete online applications while keeping sensitive decisions and final submission under user control.

## Setup

Initialize the dedicated Chrome profile:

```bash
pnpm setup:chrome-profile
```

Use the opened Chrome window to sign in, complete MFA, and configure Chrome Autofill / Password Manager if needed.

Close Chrome when finished.

## Usage

Run:

```bash
pnpm apply -- <job-url>
```

By default, the assistant uses:

```text
data/profile-full-stack.json
```

To provide a custom profile or documents:

```bash
pnpm apply -- <job-url> <profile.json> [resume] [cover-letter]
```

## How It Works

```text
Job URL
-> open application in the dedicated Chrome profile
-> fill clear profile/document fields
-> pause when user input, login, consent, or review is required
-> resume after user input
-> verify completed actions
-> stop at final review
-> user submits manually
```

The browser stays open during login, review, and final inspection.

The assistant never reads saved passwords and never submits an application automatically.

## Useful Commands

```bash
pnpm setup:chrome-profile
pnpm apply -- <job-url>
pnpm analyze:last-run
pnpm benchmark:core
pnpm benchmark:replay
pnpm test:mvp
```

## Run Artifacts

Each run saves:

```text
logs/apply/run-*/run-artifact.json
```

Use:

```bash
pnpm analyze:last-run
```

to inspect the latest run.
