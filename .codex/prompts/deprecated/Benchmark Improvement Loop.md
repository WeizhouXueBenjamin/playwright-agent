基于当前 playwright-agent 仓库，继续推进 Benchmark V2 之后的 Continuous Improvement Loop。请分 phase 实施，保持 additive migration，不破坏现有 RWVS、Benchmark Runner、V1 metrics、V1 regression gate 和历史报告。

总体目标：
把单次 Benchmark 改进流程升级为：
Benchmark -> Diagnostics -> Capability Gap -> Improvement Proposal -> Developer Approval -> Generic Fix -> Replay -> Capability History

硬性约束：
- 不删除或重命名任何 V1 字段。
- V1 regression gate 行为保持不变。
- V2 继续作为 explainability / diagnostics track。
- 所有新增指标必须来自 artifacts、executionTimeline、runtimeTimeline、verificationResults、policyEvaluation、semanticPage、validationReport、failureReport 或 backlog，不允许 LLM 主观评分。
- 不做网站特判。
- 不自动改代码，只生成 improvement proposals。
- 每个 phase 都要有 focused tests。
- 优先实现通用能力沉淀，而不是继续修单个平台。

Phase 1: Capability Evolution Log
目标：
建立 benchmark 驱动能力演进日志，用于记录每次真实 benchmark 暴露的 capability gap 和对应 generic improvement。

实现：
- 新增 capability taxonomy，例如：
  - Policy Navigation
  - Runtime State Planning
  - Field Identification
  - Semantic Matching
  - Verification
  - Recovery
  - Page Profile
  - Applicable Components
  - Safety / Policy
- 新增 capability evolution artifact：
  - benchmark/capability-evolution-log.md 或 benchmark/capability-history.json
- 每次 RWVS run 后可追加或生成 capability summary。
- 记录字段：
  - benchmark id
  - platform
  - result
  - pageProfile
  - task outcome
  - capability gap
  - evidence
  - generic improvement
  - status
  - affected layers

验收：
- QJumpers #001 记录 Safe Application Entry / Policy Navigation。
- Greenhouse #001 记录 Runtime State Planning / Skip verified fields。
- 不影响现有 benchmark-report.json 结构。

Phase 2: V2 Efficiency Metrics
目标：
让 V2 能解释“减少无效动作”这类优化收益。

实现：
在 metricsV2.task 下新增 efficiency：
- totalActions
- repeatedFieldAttempts
- skippedVerifiedFields
- averageActionsPerCompletedField
- redundantActionRatio

数据来源：
- executionReport.executedActions
- executionReport.executionTimeline
- executionReport.runtimeTimeline
- finalRuntimeState.completedFields

要求：
- 指标必须 deterministic。
- 不依赖 LLM。
- 能解释 Greenhouse actions 12 -> 8 的优化收益。
- 如果缺少历史 baseline，只输出 current efficiency，不强制 comparison。

验收：
- focused tests 覆盖 repeated field attempts。
- QJumpers 和 Greenhouse 报告都能输出 efficiency metrics。
- V1 metrics 不变。

Phase 3: V2 Task Outcome Taxonomy
目标：
把 task 结果从简单 PASS/FAIL 扩展为解释性 outcome。

实现：
在 metricsV2.task 下新增 outcome：
- status:
  - completed
  - blocked
  - needs-review
  - policy-stopped
  - max-cycles
  - aborted
- reason
- blockerLayer
- blockerCapability
- safetyOutcome

映射规则必须基于：
- executionReport.status
- executionReport.reason
- terminalState
- finalRuntimeState
- policyEvaluation
- verificationResults
- failureReport

示例：
- Greenhouse required field without usable label:
  - status: needs-review
  - blockerLayer: Task
  - blockerCapability: Field Identification
  - safetyOutcome: safe-stop
- Final submit blocked:
  - status: policy-stopped
  - blockerLayer: Decision
  - blockerCapability: Safety / Policy

验收：
- V1 PASS/REGRESSION 不变。
- benchmark.md 新增 Task Outcome section。
- tests 覆盖 needs-review、policy-stopped、max-cycles。

Phase 4: Post-mortem Report
目标：
每次 RWVS run 自动生成 objective post-mortem，沉淀诊断结论。

实现：
新增 artifact：
- reports/postmortem.md

内容：
- Task Summary
- V1 Result
- V2 Layer Diagnosis
- Page Profile
- Applicable Coverage
- Decision Metrics
- Efficiency Metrics
- Task Outcome
- Blocking Issue
- Capability Gap
- Evidence
- Suggested Generic Improvement
- Regression Replay Result, if available

要求：
- 内容从 metricsV2、healthV2、failureReport、backlog、executionReport 派生。
- 不写主观猜测。
- 不替代 benchmark.md，只作为更面向工程复盘的报告。

验收：
- RWVS run 生成 postmortem.md。
- QJumpers 和 Greenhouse postmortem 能解释不同 capability gap。
- benchmark.md 仍保持 V1/V2 summary。

Phase 5: Improvement Proposal Generator
目标：
自动生成 advisory improvement proposals，但不自动改代码。

实现：
新增 report 字段或 artifact：
- improvementProposals

每个 proposal 包含：
- capability
- title
- evidence
- affectedLayers
- expectedImpact
- regressionRisk
- suggestedScope
- candidateTests
- status: proposed | accepted | rejected | deferred

生成规则：
- 从 failureReport、metricsV2.task.outcome、metricsV2.decision、metricsV2.task.efficiency、backlog 派生。
- recurring 或 high-impact capability gap 优先级更高。
- 不生成网站特判建议。
- 不自动修改源码。

验收：
- Greenhouse required unmatched field 生成 Field Identification proposal。
- repeated verified field 问题已修复时，不再作为 open proposal，而是进入 capability history。
- tests 覆盖 proposal ranking 和 evidence extraction。

Phase 6: Recurring Issues / Capability History Aggregation
目标：
跨 benchmark 聚合 recurring capability gaps，指导下一步优先级。

实现：
新增聚合器：
- 读取 benchmark/*/history 或 reports 中的 metricsV2 / postmortem / proposals。
- 输出 capability-history.json 或 recurring-issues.md。

字段：
- capability
- occurrences
- platforms
- benchmarks
- firstSeen
- lastSeen
- priority
- status
- relatedImprovements

优先级规则：
- 多平台出现同一 capability gap -> priority 提升。
- policy/safety 问题优先级最高。
- verification regression 高优先级。
- 单平台低影响问题保持低优先级。

验收：
- 能聚合 QJumpers + Greenhouse。
- 如果多个 ATS 都出现 Semantic Matching / Field Identification，标记为 recurring issue。
- 不改变 RWVS 单次运行结果，只新增历史分析 artifact。

Phase 7: validate Command Upgrade
目标：
让 .codex/commands/validate.md 支持完整 Continuous Improvement Loop。

更新 validate.md，使其流程变为：
Benchmark
-> Diagnostics
-> Capability Analysis
-> Improvement Proposal
-> Regression Replay
-> Capability History

必须要求输出：
- V1 metrics
- V2 metrics
- Task Outcome
- Efficiency Metrics
- Post-mortem
- Improvement Proposals
- Capability Evolution Log
- Recurring Issues, if available

验收：
- validate.md 明确 V1 是 compatibility/regression track。
- V2 是 diagnostics/explainability track。
- 不要求自动改代码。
- 要求所有建议引用 artifacts evidence。

最终验收：
1. 所有新增 tests 通过。
2. 现有核心 tests 通过：
   - test:rwvs
   - test:benchmark
   - test:components
   - test:health-score
   - test:metrics-v2
   - test:decision-cycle
   - test:partial-execution
3. QJumpers #001 和 Greenhouse #001 均能生成：
   - benchmark-report.json
   - benchmark.md
   - postmortem.md
   - capability summary/history
   - improvement proposals
4. V1 regression gate 行为未改变。
5. 最终总结重点说明：
   - 新增了哪些 phase。
   - 每个 phase 的数据来源。
   - 哪些指标是 objective。
   - QJumpers 与 Greenhouse 如何体现 capability-driven improvement。