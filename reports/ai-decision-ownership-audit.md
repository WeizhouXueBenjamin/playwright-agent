# AI Decision Ownership Audit

Audit date: 2026-07-21  
Scope: production execution, production apply, partial execution, observation, contracts, safety, policy, recovery, Runtime State, and benchmark workflows. Tests and stored benchmark artifacts were used as corroborating evidence only. No production source was changed.

## 1. Executive conclusion

Architecture drift is confirmed, and is more advanced than a mixed AI/rule implementation: the live application loop has no AI semantic decision provider at all. `BrowserAIAgent.completeJobApplication` delegates to `AgentController`; `AgentController.runOnPage` calls the synchronous `runDecisionCycle`; that calls deterministic `determineNextAction`, which calls regex-driven `reasonAboutPage`, deterministic `matchFieldsToProfile`, and branch-driven `buildExecutionPlan`. Repository/package searches found no model SDK, model API request, prompt adapter, or the requested AI-decision provenance metrics.

The present path is:

```text
DOM query + page.evaluate
  -> deterministic label ranking and semantic-page projection
  -> regex/keyword page-intent classification
  -> regex/similarity/profile-alias field matching
  -> deterministic first-pending-step planner
  -> partial safety/policy checks
  -> Playwright capability adapter
  -> deterministic verification
  -> verified Runtime State update
  -> deterministic recovery branches
```

The desired observation/gate/execution foundations substantially exist and should be retained. The missing layer is an actual AI semantic reasoner between observation and the deterministic gate. Several current modules also collapse evidence into final intent/property decisions before any future AI could see it.

## 2. Actual execution paths

### Production apply workflow

1. `src/cli/complete-application.js:7 main` loads a profile and creates `BrowserAIAgent` with a persistent browser and optional terminal review provider.
2. `src/agent/browser-ai-agent.js:12 completeJobApplication` builds the profile and goal, then calls `AgentController.run`.
3. `src/agent/controller.js:52 runOnPage` creates `StateManager` and loops: observe, decide, terminate/review or execute, verify, update facts, recover.
4. `src/agent/observer.js:5 observePage` calls `captureInteractiveElements`, `buildSemanticPage`, and `buildObservationContract`.
5. `src/agent/decision-cycle.js:5 runDecisionCycle` calls `determineNextAction`, `detectTerminalState`, then creates a reporting `Decision` contract.
6. `src/agent/next-action.js:7 determineNextAction` gives page-pattern actions priority, otherwise matches all fields, builds a plan, selects the first unsatisfied step, then the first blocking required review, then the first safe navigation control.
7. `src/execution/verified-action-runner.js:7 runVerifiedAction` dispatches through the capability registry and verifies the effect.
8. `src/state/state-update-pipeline.js:28 buildSuccessfulActionStatePatch` records only verified actions as completed facts.
9. On failure, `src/recovery/recovery-engine.js:16 recover` reobserves and chooses backtrack/retry/replan/user-confirmation through fixed branches.

There is no AI call between steps 4 and 6.

### Standalone plan workflow

`match-fields` -> `plan-actions` -> `execute-plan` is also entirely deterministic. Importantly, `src/agent/executor.js:8 executePlan` accepts any plan with `status === "ready"`; it does not assert a plan/decision schema or independently run field safety and action policy. That is safe only while plans are trusted internal products. It is not an adequate gate for a future AI decision.

### Benchmark workflow

`src/benchmark/benchmark-runner.js:10 runBenchmark` loads URL/profile cases; `runBenchmarkCase` first validates components and then calls the same `runPartialExecution` production path. The report measures success, action/retry/recovery counts, validation/verification failures, and confidence. It therefore benchmarks the current deterministic system, not AI semantic generalization. The observation benchmark (`src/benchmark/benchmark-collector.js:15`) logs deterministic `reasonAboutPage` output as “reasoning.”

## 3. Decision ownership map

Owner labels distinguish semantic rules from proper deterministic controls. “Appropriate?” refers to the intended target architecture.

### Execution-point trace details

| Decision point | File / function | Input | Output | Current owner | Appropriate? | Recommended owner | Migration risk |
|---|---|---|---|---|---|---|---|
| Application goal | `agent/browser-ai-agent.js:12 completeJobApplication` | Request and options | Goal string | Deterministic configuration | Yes | User/product configuration | Low |
| Observed controls/forms | `parsers/interactive-elements.js:1 captureInteractiveElements` | Live page DOM | Serialized elements/forms | Execution/observation adapter | Yes | Deterministic observation | Medium |
| Best label | `reasoning/page-understanding.js:24,54 buildSemanticElement/chooseBestLabel` | Label candidates | Winning label + projected element | Deterministic semantic rule | Partly; projection is useful, final authority is not | Observation exposes all; AI interprets | Low |
| Observation contract | `agent/observer.js:5 observePage`; `contracts/observation.js:3 buildObservationContract` | URL/title/extracted controls | Semantic page + fingerprint | Deterministic observation | Yes, but incomplete | Deterministic observation | Medium |
| Page intent | `reasoning/page-intent.js:14 detectPageIntent` | Structured page text/state | One ranked intent/objective/target | Keyword/pattern matching | No | AI semantic reasoning; deterministic safety signals | High |
| Next page objective | `reasoning/adaptive-reasoning.js:3 reasonAboutPage` | Page intent + Runtime State | Continue/action/review objective | Deterministic semantic rule | No | AI semantic reasoning | High |
| Field intent/risk | `reasoning/field-answer-safety.js:114 classifyFieldIntent` | Field evidence | Intent, risk, evidence | Keyword/pattern matching used by safety | Partly; conservative risk detection is appropriate, final semantics are not | AI interpretation plus deterministic conservative classifier | High |
| Ordinary fact candidates | `reasoning/field-matching.js:215 rankProfileCandidates` | Field phrases + flattened profile | Ranked property/value candidates | Deterministic semantic rule | Appropriate as retrieval only | Deterministic candidate retrieval; AI selects | Medium |
| Selected profile fact | `reasoning/field-matching.js:10 matchFieldsToProfile` | Page, profile, Runtime State | One property/value or no match | Deterministic semantic rule | No | AI semantic reasoning | Medium |
| Location fact | `reasoning/location-resolution.js:27 resolveLocationProfileProperty` | Field wording + location profile | Fixed path/value | Keyword/pattern + mapping | No | AI semantic reasoning | Medium |
| Work-eligibility fact/value | `reasoning/work-eligibility-resolution.js:1 resolveWorkEligibilityProfileProperty` | Field wording/options + profile | Fixed authorization path/value | Keyword/pattern + mapping | No | AI reasoning + deterministic safety validation | High |
| Sensitive answer approval | `reasoning/field-answer-safety.js:138 evaluateFieldAnswerSafety` | Field, selected fact/review answer | Allowed/review + reason | Safety guard | Yes | Deterministic decision gate | Low |
| Execution plan | `agent/planner.js:5 buildExecutionPlan` | Field matches | Ordered steps + reviews | Deterministic planner | No for semantic ordering; yes for step materialization | AI chooses next; deterministic code materializes approved step | Medium |
| Next action | `agent/next-action.js:7 determineNextAction` | Page, profile, Runtime State | First action/review/none | Deterministic planner branches | No | AI semantic reasoning | High |
| Navigation authorization | `policy/policy-engine.js:77 evaluateNavigationPolicy` | Observed control | Allowed/not applicable/requires confirmation | Safety/policy guard | Yes for authorization, not semantic selection | AI proposes; deterministic policy gates | Low |
| Terminal status | `agent/terminal-state.js detectTerminalState` | Page + planner decision | Running/completed/review/confirmation | Policy/terminal rule | Mostly | Deterministic gate/state machine, based on gated decision | Medium |
| Decision record | `contracts/decision.js:3 buildDecisionContract` | Already-made planner decision and state | Decision v1 log object | Deterministic contract transform | No as a gate; yes as logging | Add pre-execution AI Decision v2 + Gate Result | Medium |
| Capability selection | `capabilities/capability-registry.js:97 resolveCapabilityForField` | Observed field kind | Allowlisted abstract action | Execution adapter | Yes | Deterministic capability layer | Low |
| Browser action | `capabilities/capability-registry.js:103 executeCapability`; `actions/*` | Approved internal step | Playwright effect/result | Execution adapter | Yes | Deterministic capability execution | Low |
| Verification | `execution/verified-action-runner.js:7`; `agent/verifier.js:4` | Step, before observation, live page | Verification result | Verification | Yes | Deterministic verification | Medium |
| Runtime State fact update | `state/state-update-pipeline.js:28 buildSuccessfulActionStatePatch` | Previous facts + verified action | New completed facts/status | Verification/state pipeline | Yes | Deterministic Runtime State | Low |
| Failure type | `recovery/failure-classifier.js:1 classifyFailure` | Step, observations, verification, state | Failure fact/type | Deterministic rule | Yes as factual classification | Deterministic failure evidence | Low |
| Recovery goal | `recovery/recovery-engine.js:16 recover` | Failure type + page/state | Retry/backtrack/replan/review | Deterministic recovery logic | Partly; mechanics yes, semantic goal no | AI proposes goal; deterministic gate/mechanics | High |
| Benchmark outcome | `benchmark/benchmark-runner.js:51 runBenchmarkCase`; `benchmark/benchmark-report.js:86 buildStatistics` | Dataset case + production results | Objective case statistics | Deterministic harness | Yes, but incomplete | Deterministic evaluator with semantic oracles/provenance | Medium |

### Required ownership/recommendation table

| Decision | Current Owner | Code Evidence | Recommended Owner | Recommendation |
|---|---|---|---|---|
| Goal selection | Deterministic configuration | `browser-ai-agent.js:5,12` selects a fixed default or option; input: request/options; output: goal string | User/product configuration | Keep deterministic and include verbatim in AI context. Risk: low. |
| Interactive-element extraction | Execution/observation adapter | `parsers/interactive-elements.js:1 captureInteractiveElements`; input: live DOM; output: normalized elements/forms | Deterministic observation | Keep. Add stable opaque target handles and richer raw context. Risk: medium because identity must survive re-observation. |
| Control-kind inference | Deterministic structural rule | `interactive-elements.js inferKind`; input: tag/type/role; output: capability-oriented kind | Deterministic observation | Keep as structural evidence; preserve raw tag/type/role. Risk: low. |
| Label candidate creation | Deterministic observation heuristic | `interactive-elements.js collectLabelCandidates`; input: DOM/a11y/nearby text; output: weighted candidates | Deterministic observation | Keep candidates and sources; treat weights as evidence, not truth. Risk: low. |
| Best-label selection | Deterministic semantic rule | `reasoning/page-understanding.js:24,54`; input: candidates; output: one winning label | Observation should expose all; AI may interpret | Keep `bestLabel` only as a convenience, never discard candidates. Risk: low. |
| Page “semantic” projection | Deterministic structural transform | `page-understanding.js:1 buildSemanticPage`; input: extracted elements/forms; output: semanticPage | Deterministic observation | Rename conceptually to structured observation; add sections, nearby text, constraints and capabilities. Risk: medium. |
| Page intent | Keyword/pattern matching | `page-intent.js:14 detectPageIntent` sorts nine fixed detectors; input: title/labels/text/state; output: one intent/confidence/objective/target | AI semantic reasoning; safety recognizers remain gate evidence | Replace final intent authority with AI. Retain login/confirmation/irreversible signals as deterministic warnings. Risk: high because it affects navigation. |
| Page objective | Deterministic semantic branch | `adaptive-reasoning.js:3 determineNextObjective`; input: page intent/runtime state; output: continue/action/review | AI semantic reasoning | AI proposes goal/target; gate checks target and policy. Risk: high. |
| Adaptive click target | Keyword/pattern matching | `page-intent.js:157 findButton` and detector regexes; output: first matching button | AI semantic reasoning + deterministic policy gate | Make patterns candidate/evidence generators. Never execute solely from the heuristic. Risk: high. |
| Matchable-field filtering | Deterministic structural rule | `field-matching.js:184 getMatchableFields`; input: kinds/disabled/readonly; output: candidate fields | Deterministic observation/gate | Keep. Risk: low. |
| Sensitive field classification | Keyword/pattern matching used by safety guard | `field-answer-safety.js:114 classifyFieldIntent`; eight fixed intent groups; output: risk/intention/evidence | Hybrid: AI interpretation plus conservative deterministic safety classifier | Do not weaken. Treat either AI or deterministic classifier marking high risk as high risk. Unknown/ambiguous sensitive signals fail to review. Risk: high. |
| Low-risk field interpretation | Deterministic text similarity | `field-matching.js:215 rankProfileCandidates` and `text-similarity.js`; input: field phrases/aliases; output: ranked paths | AI semantic reasoning | Send raw field evidence and relevant fact candidates to AI. Keep ranker as shadow/fallback/evidence. Risk: medium. |
| Location intent and fact selection | Keyword/pattern + fixed mapping | `location-resolution.js:13,27`; input: field text/profile; output: fixed location path/value at confidence 100 | AI semantic reasoning | Remove final authority and false certainty; retain candidates. Risk: medium. |
| Work-eligibility interpretation/value conversion | Keyword/pattern + fixed mapping | `work-eligibility-resolution.js:1,21`; input: wording/options/profile; output: mapped authorization answer | AI interpretation, deterministic safety validation | AI selects explicit fact/option; gate enforces explicit country-scoped provenance and option compatibility. Risk: high. |
| Referral-source choice | Platform-flavoured deterministic default | `field-matching.js:97-125,203-213`; selects first branded checkbox at confidence 100 | User/product policy only if explicitly configured; otherwise AI/review | Remove implicit “first option” authority. Never call it product policy without configuration. Risk: high (can assert a false source). |
| Profile alias ontology | Fixed vocabulary | `profile/profile-properties.js:1-34`; aliases for identity, location, links, salary, eligibility, education, etc. | Candidate/evidence generator | Retain to narrow context and as fallback; stop treating alias score as final semantics. Risk: medium. |
| Candidate acceptance threshold | Deterministic semantic rule | `field-matching.js:10,28-63`; threshold 45, top candidate; output match/no match | AI decision plus deterministic confidence/review policy | AI supplies evidence/uncertainty; gate does not trust confidence alone. Keep threshold for legacy fallback. Risk: medium. |
| Profile-fact allowlist for sensitive fields | Safety invariant | `field-answer-safety.js:101-111,309`; input: sensitive intent/path; output: allowed/rejected | Deterministic decision gate | Keep; validate provenance/value/scope as well as leaf key. Risk: low if additive. |
| Sensitive value compatibility | Safety guard | `field-answer-safety.js:222-307`; option, boolean, salary, consent/fingerprint checks | Deterministic decision gate | Keep and broaden its input contract so AI cannot bypass it. Risk: low. |
| User-review answer scoping | Safety guard | `review/review-resolution.js` fingerprints fields/statements and run-scopes answers | Deterministic decision gate/Runtime State | Keep. AI may formulate question; deterministic code binds authorization. Risk: low. |
| Full plan construction and ordering | Deterministic planner | `planner.js:5 buildExecutionPlan`; loops matches in DOM order | AI semantic planning, optionally one decision per cycle | AI decides next unresolved goal/action. Gate permits one reversible action. Legacy planner remains fallback/shadow. Risk: medium. |
| Next pending field | Deterministic first-match branch | `next-action.js:16-29`; first unsatisfied planned step | AI semantic reasoning | Move to AI-primary planning after field-decision reliability. Risk: medium. |
| Blocking review item | Deterministic required-first rule | `next-action.js:42-50,56-60`; only required review items block | Hybrid: AI ambiguity proposal + deterministic mandatory safety review | Keep deterministic safety review; let AI also request review for semantic ambiguity, including optional fields. Risk: low. |
| Navigation selection | Keyword/pattern policy | `next-action.js:153` takes first control allowed by `evaluateNavigationPolicy` | AI proposes; deterministic policy authorizes | Separate “semantically useful” from “safe.” Safe does not imply correct. Risk: high. |
| Capability selection | Deterministic execution adapter | `capability-registry.js:50,97`; field kind -> fill/check/select/upload/click | Deterministic execution layer | Keep allowlisted capabilities. Reject unsupported kind instead of defaulting to text-input. Risk: low. |
| Irreversible-action protection | Safety/policy guard | `policy-engine.js:36,77,105`; fixed label patterns stop submission and other irreversible actions | Deterministic decision gate | Keep and strengthen with structural signals (`type=submit`, form semantics), default-deny uncertainty. Risk: low. |
| Decision contract creation | Deterministic reporting transform | `contracts/decision.js:3`; built after planner/terminal decision; output omits selected value and target id | Deterministic gate contract around an AI proposal | Introduce additive schema v2 and validate before planning/execution. Risk: medium. |
| Decision contract validation | Weak contract check | `contracts/decision.js:49`; validates version, goal, evidence object, summary string, alternatives array | Deterministic decision gate | Validate decision type, target existence, fact existence/value/provenance, capability support, expected postcondition, uncertainty, safety/policy results. Risk: medium. |
| Browser action execution | Execution adapter | `executor.js:74`, `capability-registry.js:103`, `actions/*`; input: approved abstract step; output: Playwright effect/result | Deterministic capability execution | Keep. AI must never provide selectors or JavaScript. Risk: low. |
| Locator resolution | Execution adapter | `actions/locator.js`; input: observed field evidence; output: internal Playwright locator | Deterministic capability execution | Keep internal. Prefer stable opaque element handle + re-resolution; never expose selectors to AI. Risk: medium. |
| Effect verification | Verification | `verifier.js:4`, `verified-action-runner.js:7`; input: step/live page; output: expected/actual/ok | Deterministic verification | Keep. Upgrade click verification from “fingerprint changed” to decision-specific postconditions. Risk: medium. |
| Runtime State updates | Verification/fact pipeline | `state-manager.js` and `state-update-pipeline.js:28`; verified success only | Deterministic Runtime State | Keep. Add unresolved/blocker/decision provenance facts without adding speculation. Risk: low. |
| Already-satisfied detection | Deterministic verification/planner helper | `next-action.js:107-145`; compares observed state/completed facts | Deterministic verification/gate | Keep, but use field ID plus page identity rather than label/path alone. Risk: medium. |
| Failure classification | Deterministic rule | `recovery/failure-classifier.js:1`; fixed precedence over observations/errors | Deterministic failure facts plus AI recovery proposal | Keep classification as evidence; do not let it solely choose a semantic recovery goal. Risk: low. |
| Retry/backtrack | Execution invariant | `recovery-engine.js:16-76`, `retry-policy.js`; fixed bounded reversible operations | Deterministic execution after gate | Keep bounded retries; require policy check for backtrack/navigation. Risk: low. |
| Recovery goal selection | Deterministic planner branch | `recovery-engine.js:26-43`; type -> backtrack/retry/replan/review | AI proposes after deterministic failure facts, gate authorizes | Move semantic recovery proposal to AI in Migration 3. Keep automatic retry for clearly reversible transient failures. Risk: high. |
| Benchmark case execution | Production adapter | `benchmark-runner.js:51` calls validation then `runPartialExecution` | Deterministic harness | Keep, but add semantic oracle labels and AI provenance metrics. Risk: medium. |
| Benchmark success scoring | Objective deterministic metrics, incomplete | `benchmark-report.js:86`; status/counts/confidence | Deterministic benchmark evaluator | Keep objective scoring; add target/fact/review/gate/verification/pattern-dependence metrics. Risk: low. |

## 4. Evidence confirming architecture drift

The following jointly confirm drift:

- No AI provider exists in dependencies or `src`; the only runtime dependencies are Playwright packages.
- “Adaptive reasoning” is `detectPageIntent` plus fixed `if` branches, not a model decision (`adaptive-reasoning.js:3`).
- Page intent is chosen by sorting nine regex/keyword detectors (`page-intent.js:14-35`).
- Field interpretation and fact selection are based on a fixed alias table, Dice token similarity, thresholds, and special-case resolvers (`profile-properties.js`, `text-similarity.js`, `field-matching.js`).
- Location and work-eligibility resolvers turn wording into fixed profile paths/values, then report confidence 100 (`field-matching.js:68-95`).
- Planner authority is first matching field, first blocking required review, then first “safe” navigation control (`next-action.js`).
- Recovery choice is a deterministic failure-type branch (`recovery-engine.js`).
- Existing reports call deterministic output “reasoning,” which can obscure the absence of AI.
- No decision provenance or shadow/accepted/rejected AI metrics exist.

Counterevidence worth preserving: the project has strong deterministic pieces in observation, capability execution, verification, Runtime State contracts, bounded recovery, and human confirmation. Drift is therefore a responsibility-boundary issue, not a reason to rewrite the application.

## 5. Components that should remain deterministic

- DOM/accessibility extraction, visibility/state/validation collection, and opaque element identity.
- Observation, AI-decision, gate-result, verification, and Runtime State schemas.
- Field Answer Safety Guard, including explicit-value/provenance rules, option compatibility, salary constraints, and statement-scoped consent authorization.
- Policy and irreversible-action protection. AI may identify risk but cannot lower it.
- Capability allowlist and Playwright implementation, including internal locator construction.
- Precondition checks, expected-postcondition verification, and verified-only Runtime State updates.
- Bounded retry for reversible transient failures and protection against Runtime State contradictions.
- Objective benchmark evaluation.

## 6. Components that should move toward AI decisions

- Page goal/state interpretation beyond structural facts and hard safety signals.
- Field meaning based on label, section, nearby copy, options, and task context.
- Selection of one explicit profile fact, including choosing among plausible facts.
- Which unresolved field/section/action to handle next.
- Semantic ambiguity detection and wording of review questions.
- Goal-directed recovery proposals after deterministic failure observation.

Patterns can remain as evidence generators, candidate reducers, conservative safety classifiers, and legacy fallback. They should cease being authoritative semantic decisions.

## 7. Target four-layer architecture

```text
Layer A: deterministic observation
  captureInteractiveElements -> structured Observation v2
            |
            v
Layer B: AI semantic reasoning
  raw evidence + relevant facts + Runtime State -> AI Decision v2
            |
            v
Layer C: deterministic decision gate
  schema + target/fact/capability checks + safety + policy -> approved/rejected/review
            |
            v
Layer D: deterministic capability execution
  internal locator/capability -> verification -> Runtime State -> next observation
```

### Existing-module mapping and violations

| Layer | Existing modules to retain/evolve | Current boundary violations |
|---|---|---|
| A — Observation | `parsers/interactive-elements.js`, `agent/observer.js`, `reasoning/page-understanding.js`, `contracts/observation.js` | `chooseBestLabel` collapses candidates; nearby/section/constraint context is weak; supported capabilities are not exposed; “semanticPage” implies more certainty than it contains. |
| B — AI reasoning | New `reasoning/ai-decision-provider` interface; legacy `page-intent`, `field-matching`, location/work resolvers become evidence/fallback | No AI implementation exists. Current deterministic modules own all semantics and planning. |
| C — Decision gate | Evolve `contracts/decision.js`, `field-answer-safety.js`, `policy-engine.js`, `review-resolution.js`; add target/fact/capability/state validators | Current contract is built after planning and barely validated. Safety is embedded in matcher rather than unavoidable at execution boundary. Policy is applied to navigation/adaptive clicks, not uniformly to every externally supplied plan. |
| D — Execution | `capabilities/*`, `actions/*`, `verified-action-runner.js`, `verifier.js`, `state/*`, bounded recovery operations | Capability resolution silently falls back to text input; click postcondition is only any fingerprint change; standalone ready-plan execution has no gate token. |

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI selects a semantically wrong fact with high confidence | Never gate on confidence alone; require referenced fact/value/provenance to exist, preserve alternatives, use shadow comparison and verification. |
| Sensitive intent phrasing evades patterns | Conservative union: AI-sensitive OR deterministic-sensitive OR ambiguous => safety review. Expand structural safety signals; do not downgrade on AI output. |
| Prompt injection in page text | Treat page text as untrusted evidence, delimit it, prohibit instructions from changing goal/policy, and validate every output reference/capability. |
| AI invents targets, facts, selectors, or capabilities | Schema permits only observed `elementId`, enumerated fact reference, and registry capability. Reject unknown references. No selector/JavaScript fields. |
| Stale observation between decision and action | Bind decision to observation fingerprint; reobserve/reject if changed. |
| “Safe” navigation is wrong for the goal | AI proposes semantics; policy merely authorizes. Verify decision-specific postconditions. |
| Existing workflow regresses during migration | Additive v2 contracts, feature flags, shadow decisions, legacy fallback, per-field rollout, and benchmark gates. |
| Model latency/cost harms loop | One abstract action per turn, relevant-fact retrieval, compact structured context, caching only for identical observation/state hashes. |
| Non-deterministic benchmark results | Fixed datasets, exact semantic oracles, repeated trials, deterministic gate scoring, report model/version/config and separate model failure from execution failure. |

## 9. Additive migration plan

### Migration 0 — Decision provenance and enforceable gate seam

Add provenance to every planner/gate result: `ai`, `deterministic-semantic-rule`, `safety-guard`, `policy`, `executor`, or `recovery-logic`. Add exactly these counters to run reports and benchmark aggregation:

- `aiSemanticDecisionCount`
- `deterministicSemanticDecisionCount`
- `safetyOverrideCount`
- `policyOverrideCount`
- `aiDecisionAcceptedCount`
- `aiDecisionRejectedCount`
- `reviewDecisionCount`

Before any AI authority, create a single pre-execution gate used by the controller and standalone `execute-plan`: assert schema, bind observation fingerprint, resolve observed target, resolve exact profile fact/provenance, re-run safety and policy, validate capability, and issue an approved internal step. This does not change semantic ownership yet and is the recommended first implementation phase.

### Migration 1 — Shadow AI decisions

For low-risk fields, build AI context from Observation v2 + relevant profile facts + Runtime State. Record the AI decision but do not execute it. Compare intent, fact, target, capability, expected postcondition, ambiguity/review choice, and gate result with legacy output. Do not silently omit rejected shadow decisions.

### Migration 2 — AI-primary low-risk fields

Enable name, email, phone, city, country, school, and degree only after benchmark thresholds are met. Every proposal uses the Migration 0 gate. Keep matcher output as fallback and comparison baseline, with provenance.

### Migration 3 — AI-primary planning

Let AI select the next unresolved field/section, navigate/continue choice, semantic review requirement, and recovery goal after verified failure. Policy, safety, capability execution, retry limits, verification, and Runtime State remain deterministic.

### Migration 4 — Reduce pattern authority

Convert page-intent regexes, profile aliases, location/work resolvers, and planner branches into evidence/candidate generation, conservative safety classification, or explicit fallback. Remove implicit referral-source selection. Do not remove safety invariants.

## 10. Benchmark strategy

Build a local synthetic semantic suite plus consented real-page fixtures. Each fixture stores raw structured observation, profile facts with provenance, expected target/fact or required-review outcome, allowed capabilities, and expected postcondition. Include:

- “Which place do you call home?” with `location.city` and `location.country` both present.
- “Where will you be working from?” under sections that distinguish current residence from work location.
- “Are there restrictions on your ability to work here?” with and without explicit country-scoped authorization.
- weak labels where section heading/nearby text carries meaning.
- two plausible facts (city vs region, school vs employer, preferred vs legal name).
- unfamiliar wording for name, email, phone, country, school, degree, resume, and cover letter.
- adversarial page text that attempts to alter policy or request submission.
- option mismatches, stale observation fingerprints, unsupported controls, and verification failure/recovery cases.

Score objectively:

1. exact observed target selection;
2. exact profile-fact path and provenance selection;
3. deterministic gate acceptance/rejection correctness;
4. capability correctness;
5. expected-postcondition validity and verification success;
6. correct request-review choice;
7. safety/policy override frequency and false-negative rate;
8. pattern dependence: outcomes retained after selected semantic patterns are removed.

Run three ablations, not two: (A) patterns + AI, (B) selected semantic patterns removed + same AI/raw evidence, and (C) legacy patterns without AI. Report per-intent accuracy, review precision/recall, gate rejection reasons, execution verification rate, and confidence calibration. Do not use an LLM judge as the success oracle.

## 11. Recommended first implementation phase

Approve Migration 0 only: decision provenance, metrics, Observation/Decision v2 additive shapes, and one mandatory deterministic pre-execution gate used by all execution entry points. Then add a non-executing shadow AI adapter for a fixture-based low-risk benchmark. This phase creates measurable evidence and closes the current gate seam without changing production semantic authority, weakening safety, or risking automated submission.

## 12. Audit limitations

This was a static code-path audit plus inspection of tests/workflow definitions. Live ATS pages were not exercised because architecture ownership is determined by the code path and the prompt prohibited implementation, not because observed sites were assumed. Stored benchmark data is dominated by Greenhouse and QJumpers, so it cannot demonstrate ATS-independent semantic generalization.
