# 开发与生产本地数据隔离

作用域：
- `repo`

适用：
- Tauri identifier、桌面启动脚本、应用数据目录或 SQLite 路径变更。

结论：
- 生产 identifier 固定为 `com.feedforge.app`；开发运行通过 `tauri.dev.conf.json` 覆盖为 `com.feedforge.app.dev`。
- `db::init_db` 将唯一的 `feed-forge.db` 放在 `app_data_dir`，该目录由 identifier 决定。因此环境隔离覆盖设置、订阅、文章和阅读状态，而不只是设置表。
- 开发统一使用 `pnpm desktop:dev`，生产构建使用 `pnpm desktop:build`；生产构建不得合并开发配置。

联动：
- 修改 identifier、启动脚本、数据库路径或新增应用目录文件时，应同时验证开发与生产仍落入不同的数据目录。

证据：
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.dev.conf.json`
- `src-tauri/src/db.rs`
- `package.json`
