# Feed Forge Repository Instructions

## 项目边界

- Feed Forge 是 Tauri v2、React、TypeScript 和 Vite 构建的桌面应用。
- 前端源码位于 `src/`，Rust 与 Tauri 代码位于 `src-tauri/`，长期项目文档位于 `docs/`。
- JavaScript 包管理和脚本统一使用 pnpm；Rust 命令应显式指向 `src-tauri/Cargo.toml`。
- 修改应聚焦当前任务，遵循已有目录、命名、依赖和测试模式，不预先引入尚无实际需求的抽象。

## 外部文档

- 涉及库、框架、SDK、API、CLI 或云服务的语法、配置、迁移、调试和用法时，使用 Context7 获取当前文档，即使相关技术很常见。
- 先用 `resolve-library-id` 解析库名，再用选定的 `/org/project` ID 和完整问题调用 `query-docs`；用户已提供精确 ID 时可直接查询。
- 优先选择名称准确、主题相关、信誉较高且与项目版本匹配的来源。
- 业务逻辑调试、普通重构、自编脚本和代码审查不需要为此调用 Context7。

## 代码导航

- 仓库根存在 `.codegraph/` 时，理解或定位代码应先使用 CodeGraph 的 `explore` 或 `node`，再按需读取文件或使用文本搜索。
- 不存在 `.codegraph/` 时直接使用 `rg` 和必要的文件读取，不自行创建索引。
- 搜索应从目标路径、符号、错误文本和业务词开始，避免无范围扫描生成目录和依赖目录。

## 仓库技能

- 任务匹配 `.agents/skills/` 下某个 Skill 的说明时，先完整阅读对应 `SKILL.md`，再按其中流程执行。
- 涉及 Tauri v2 的命令、配置、权限、插件、窗口、事件或 Rust 集成时，使用 `tauri-v2`。
- 涉及 shadcn 组件、registry、样式、组合或 `components.json` 时，使用 `shadcn`。
- 修改 changelog 时，使用 `changelog`，且只维护现有格式下的 `Unreleased` 内容。

## 仓库知识沉淀

- 进行非简单仓库分析、设计、调试、代码变更或代码审查时，使用 `curating-repository-knowledge`。
- 开始任务时，如果 `.agents/knowledge/INDEX.md` 存在，先按当前作用域和关键词检索索引，只读取匹配的知识卡；不存在时正常继续，不创建空索引。
- 知识卡只作为线索，必须用当前代码、测试和用户确认的决策重新核实。
- 结束任务时，只记录稳定、非显然、可复用、会影响未来决策且有证据的知识；没有合格增量时不创建或修改知识文件。
- 纯机械修改、只读任务或用户限制写入范围时，遵守该 Skill 的知识准入和写入边界。
- 不在知识文件中保存凭据、令牌、Cookie、签名 URL、敏感配置值或无证据的推测。
- 当知识已经形成重复的复杂执行流程时，建议提炼专项 Skill，但未经用户确认不得自行创建。

## 测试与验证

- 修改功能、测试、IPC 或 Rust 命令前，必须阅读 `docs/testing-strategy.md`。
- 测试的当前规则、标准命令和未来规划以 `docs/testing-strategy.md` 为准；`docs/superpowers/specs/` 和 `docs/superpowers/plans/` 仅用于历史追溯。
- 达到测试路线图的升级触发条件时，必须先更新 `docs/testing-strategy.md`，将状态改为 `已触发`，再重新评估测试栈。
- 验证范围应与变更风险匹配；声明完成、通过或修复前，必须运行并检查能够证明该结论的最新命令。
- 纯文档变更至少检查目标链接、格式、`git diff --check` 和最终变更范围。

## Git 与工作树

- 现有未提交改动属于用户；保留无关改动，并在重叠文件中基于当前内容工作。
- 不使用破坏性 Git 命令，不批量暂存无关路径，不擅自整理或回退用户改动。
- 用户要求“提交”时，只暂存本次明确范围内的路径，提交前检查 staged diff，并使用中文 Conventional Commit。
- 未经用户明确要求，不提交、不推送、不创建 PR。
