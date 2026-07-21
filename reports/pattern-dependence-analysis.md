# Pattern Dependence Analysis

Audit date: 2026-07-21  
Counting method: a “rule” below is a logical rule family (one branch, mapping, detector, or invariant), not each regex alternative. This avoids inflating counts when one decision has many spelling variants. The inventory is production code only; tests and stored benchmark artifacts are excluded.

## Summary

| Category | Logical rule families | Assessment |
|---|---:|---|
| Safety invariant | 12 | Keep deterministic. Some depend on heuristic detection, so use a conservative union with AI interpretation rather than removing them. |
| Execution invariant | 12 | Keep deterministic and capability-bound. |
| Semantic heuristic | 22 | Currently authoritative in many places; convert to AI evidence/candidates/fallback. |
| Platform-specific workaround/assumption | 3 | One affects production answers and should be removed; two are reporting labels and should be isolated as metadata. |
| **Total** | **49** | The system’s semantic behavior is pattern-led. |

Additional vocabulary indicators:

- 32 profile-property alias keys form a fixed applicant/ATS ontology in `src/profile/profile-properties.js`.
- 9 fixed page-intent types are ranked in `src/reasoning/page-intent.js`.
- 8 fixed high-risk field intents, with regex alternatives and leaf-property allowlists, are defined in `src/reasoning/field-answer-safety.js`.
- 9 location intents are recognized by wording and mapped to fixed profile paths in `src/reasoning/location-resolution.js`.
- 5 browser capability types are allowlisted in `src/capabilities/capability-registry.js`; these are appropriate execution invariants.

## Rule inventory

### Safety invariants — keep deterministic

| # | Rule family | Evidence | Treatment |
|---:|---|---|---|
| S1 | Conservatively recognize salary, eligibility, sponsorship, visa, consent, legal declaration, and referral as high risk | `field-answer-safety.js:3-99,114` | Keep as a safety classifier. AI may add risk; it cannot downgrade this result. |
| S2 | Sensitive fields require an explicit fact or current review answer | `field-answer-safety.js:157-165` | Keep. |
| S3 | Sensitive intents accept only allowlisted fact keys | `field-answer-safety.js:101-111,309` | Keep; extend to exact path/provenance/scope validation. |
| S4 | Empty sensitive values are rejected | `field-answer-safety.js:232-234` | Keep. |
| S5 | Option fields require an available enabled option | `field-answer-safety.js:240-242,426-443` | Keep. |
| S6 | Boolean/status answers must be type-compatible | `field-answer-safety.js:244-250,450-476` | Keep. |
| S7 | Salary values obey numeric, hourly/annual, currency, and period constraints | `field-answer-safety.js:259-283,482-507` | Keep. Semantic interpretation can be AI-owned; validation remains deterministic. |
| S8 | Consent/legal authorization is current-statement and scope fingerprint bound | `field-answer-safety.js:285-307,509-518` | Keep. |
| S9 | Review answers are run/field/statement scoped | `review/review-resolution.js` | Keep. |
| S10 | Final submission and other irreversible actions require confirmation | `policy-engine.js:20-74,105-141` | Keep; augment label patterns with structural facts. |
| S11 | Only verified successful actions update completion facts | `controller.js:160-162`, `state-manager.js:21-26` | Keep. |
| S12 | Runtime State rejects confidence/reasoning/speculation keys | `contracts/runtime-state.js:3-48` | Keep verified-facts-only invariant. |

### Execution invariants — keep deterministic

| # | Rule family | Evidence | Treatment |
|---:|---|---|---|
| E1 | Extract only visible, interactive DOM controls and forms | `parsers/interactive-elements.js:1` | Keep; enrich observations. |
| E2 | Infer structural control kind from tag/type/role | `interactive-elements.js inferKind` | Keep raw attributes alongside inference. |
| E3 | Resolve approved observed targets through internal role/label/placeholder/file locators | `actions/locator.js` | Keep internal; AI never receives or invents selectors. |
| E4 | Fill text capability | `capabilities/capability-registry.js:8-14`, `actions/fill.js` | Keep. |
| E5 | Set checkbox capability | `capability-registry.js:15-21`, `actions/checkbox.js` | Keep. |
| E6 | Select option/radio capability | `capability-registry.js:22-28`, `actions/select.js` | Keep exact enabled-option checks. |
| E7 | Upload file capability | `capability-registry.js:29-35`, `actions/upload.js` | Keep. |
| E8 | Click observed button/link capability | `capability-registry.js:36-42`, `actions/click.js` | Keep after policy approval. |
| E9 | Wait for page/interaction stability | `browser/stability.js` | Keep. |
| E10 | Verify field values, selections, checked state, and uploads | `agent/verifier.js:4` | Keep; support decision-specific postconditions. |
| E11 | Reobserve and compare fingerprint after click | `execution/verified-action-runner.js:27-39` | Keep as minimum verification, not sufficient semantic success. |
| E12 | Bound retry/backtrack and stop on unverifiable recovery | `recovery/retry-policy.js`, `recovery/recovery-strategies.js` | Keep reversible mechanics; gate any navigation. |

### Semantic heuristics — evidence, candidates, or fallback; not final authority

| # | Rule family | Evidence | Current authority/problem | Recommended role |
|---:|---|---|---|---|
| H1 | Highest weighted label candidate becomes the label | `page-understanding.js:54-64` | Collapses ambiguity before reasoning. | Convenience evidence; send all candidates. |
| H2 | Candidate page intents are confidence-sorted | `page-intent.js:14-35` | Fixed numeric scores create apparent semantic confidence. | Candidate signals only. |
| H3 | Cookie banner detection/targeting | `page-intent.js:60-65` | Keyword + first matching button can choose meaning/action. | AI evidence; policy still gates. |
| H4 | Modal dialog detection/targeting | `page-intent.js:67-74` | “close/continue/ok” vocabulary owns next action. | AI evidence; dialog role remains structural. |
| H5 | Login-page detection | `page-intent.js:76-84` | Vocabulary makes final page interpretation. | AI evidence plus deterministic credential policy. |
| H6 | Resume-import page detection | `page-intent.js:86-92` | Fixed resume/import words. | AI interpretation. |
| H7 | Confirmation-dialog semantic detection | `page-intent.js:94-100` | Useful safety signal but insufficient page meaning. | Conservative safety evidence; AI may also request review. |
| H8 | Onboarding-flow detection/targeting | `page-intent.js:102-107` | First familiar navigation word owns action. | AI interpretation. |
| H9 | Dynamic-validation objective | `page-intent.js:109-120` | Browser invalidity is factual; “continue matching” is a plan. | Keep invalidity fact; AI proposes resolution. |
| H10 | Any fillable fields imply application-form intent | `page-intent.js:122-125` | Coarse final semantic classification. | Evidence only. |
| H11 | Fieldless page + familiar button implies intermediate page | `page-intent.js:127-132` | Can navigate unrelated flows. | AI interpretation. |
| H12 | Fixed profile alias table | `profile-properties.js:1-34` | 32-key implicit ATS/applicant ontology determines candidate semantics. | Candidate retrieval/evidence and fallback. |
| H13 | Dice token overlap and fixed stop words | `text-similarity.js` | Lexical overlap becomes semantic score. | Candidate retrieval only. |
| H14 | Fixed phrase-source weights | `field-matching.js:251-263` | Label/placeholder/options weights determine fact choice. | Retrieval ranking; expose scores as non-authoritative. |
| H15 | Match threshold 45 and top candidate | `field-matching.js:10,28-63` | Final fact selection/no-match without AI. | Legacy fallback/shadow comparator. |
| H16 | Location wording -> nine intents -> fixed property precedence | `location-resolution.js:13-79` | Returns final property/value and is promoted to confidence 100. | Generate explicit location fact candidates/evidence. |
| H17 | Work-eligibility wording -> fixed answer conversion | `work-eligibility-resolution.js` | Converts status into “Yes” or canonical visa labels. Country/context loss is possible. | AI interpretation; deterministic explicit-fact/value safety. |
| H18 | Referral checkbox group and first-option default | `field-matching.js:97-125,192-213` | Asserts a source at confidence 100 without profile/user evidence. | Remove. Require configured policy, explicit fact, or review. |
| H19 | DOM-order plan construction | `planner.js:5-25` | Completes every acceptable match in fixed order. | Legacy baseline; AI chooses next goal. |
| H20 | Only required review items block | `next-action.js:56-60` | Optional ambiguous/high-impact semantics can be skipped without an explicit decision. | AI may request review; gate mandates safety review. |
| H21 | First policy-safe navigation control is next | `next-action.js:151-157` | Conflates safe with goal-correct. | AI proposes; policy authorizes. |
| H22 | Failure type directly chooses recovery goal | `recovery-engine.js:16-45` | Replan/backtrack/review meaning is fixed. | Keep failure facts and bounded transient retry; AI proposes goal-directed recovery later. |

### Platform-specific workarounds/assumptions

| # | Rule family | Evidence | Recommendation |
|---:|---|---|---|
| P1 | Referral-source detection embeds LinkedIn, Indeed, Seek, Glassdoor and job-board wording | `field-matching.js:203-213` | Remove production default selection. Generic option observations should go to AI/user review. |
| P2 | Greenhouse/QJumpers URL substring -> platform name | `rwvs/capability-evolution.js:277-278` | Isolate as optional reporting metadata; it must never affect decisions/capabilities. Prefer dataset-declared platform. |
| P3 | Duplicate Greenhouse/QJumpers platform inference | `rwvs/recurring-issues.js:196-197` | Consolidate reporting-only metadata adapter; no production planning dependency. |

No ATS-specific selector or execution branch was found in `actions`, `capabilities`, `agent`, or `policy`. That is a positive boundary to preserve. The stored benchmark corpus and histories, however, are heavily concentrated on Greenhouse and QJumpers and cannot establish platform independence.

## Semantic decisions currently made without AI

All production semantic decisions are made without AI:

- current page intent and objective;
- which control a modal/cookie/onboarding/intermediate page should click;
- field intent and whether it is treated as low risk;
- relevant profile-property ranking and final selection;
- location property selection and formatting;
- work-eligibility option/boolean conversion;
- referral source selection;
- which field to handle next;
- whether an unmatched optional field matters;
- which navigation control advances the goal;
- semantic recovery route.

The phrase “AI” in `BrowserAIAgent` and “reasoning” in logs is therefore descriptive naming, not evidence of AI ownership.

## Duplicated intent and normalization logic

1. Work eligibility is independently recognized in `field-answer-safety.js` and `work-eligibility-resolution.js`; both also implement boolean/status vocabulary.
2. Location meaning exists in the generic alias ontology and the separate location resolver, with different precedence/authority.
3. Consent/agreement wording exists in profile aliases, sensitive intent rules, value conversion in planner/review code, and policy confirmation terms.
4. Navigation vocabulary is duplicated across `page-intent.js` (`continue`, `next`, etc.) and `policy-engine.js`.
5. Field text is assembled differently in `field-matching.js`, `field-answer-safety.js`, `location-resolution.js`, and `work-eligibility-resolution.js`, so the same page evidence can yield inconsistent classifications.
6. Boolean normalization appears in planner, work-eligibility resolution, and field safety.
7. Greenhouse/QJumpers reporting inference is duplicated across two RWVS modules.

Centralize only deterministic evidence normalization and safety primitives. Do not centralize these into a larger authoritative semantic ontology.

## Fixed mappings becoming an implicit ATS ontology

`PROFILE_PROPERTY_ALIASES` is not merely a search helper in the current path: its 32 keys define what ordinary fields can mean, its phrases determine lexical scores, and the top score becomes the selected fact. `ALLOWED_PROFILE_KEYS_BY_INTENT`, the location path table, work-authorization conversions, and referral-source brand list extend that ontology. As a result, supporting unfamiliar wording or a new profile concept naturally invites adding another alias/regex/mapping.

Evidence that “add another pattern” is the default fix shape:

- page behavior is extended by another detector phrase/button regex;
- sensitive coverage is extended by another `INTENT_RULES` regex;
- profile support is extended by another alias key/phrase;
- location support is extended by another location regex/path branch;
- eligibility support is extended by another status/option regex;
- referral sources are extended by another branded word.

This produces local test gains while obscuring semantic generalization. Migrations 1–4 should explicitly measure whether results survive removal of selected semantic patterns.

## Recommended disposition

- Keep S1–S12 and E1–E12 deterministic.
- Convert H1–H17 and H19–H22 into raw evidence, candidate generation, shadow comparison, or explicit legacy fallback.
- Remove H18/P1’s implicit answer selection.
- Keep P2/P3 reporting-only and consolidate them outside the decision path.
- For safety detection, use the conservative union of pattern signals, AI interpretation, field structure, and explicit policy; never let a missing keyword imply low risk by itself once AI-primary decisions are enabled.

