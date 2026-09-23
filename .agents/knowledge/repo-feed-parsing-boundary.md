# 订阅解析与内容安全边界

作用域：
- `repo`

适用：
- 修改 `src-tauri/src/modules/sync/parser.rs`、订阅抓取字节处理、文章稳定 ID 或正文渲染安全策略时。

结论：
- RSS 0.91/0.92/1.0/2.0、Atom 1.0 与 JSON Feed 1.x 统一由 `feed-rs` 解析；响应体以原始字节传入，并将订阅 URL 作为 base URI 解析相对链接。
- 缺失条目 ID 时，稳定 ID 依次回退到页面链接和标题。页面链接只接受缺省关系或 `alternate`，不能用 `self`、`related` 或 `enclosure`，否则会改变历史去重键并暴露非文章 URL。
- Rust 解析层关闭 `feed-rs` 内容清洗以保留订阅正文；最终 HTML 安全边界在前端 DOMPurify，调整任一侧时必须核对另一侧。

联动：
- 更换解析器或升级 `feed-rs` 时，同时验证协议样例、未知格式拒绝、相对链接、RFC 3339 日期、缺失 ID 回退和非 `alternate` 链接。
- 不改变现有 IPC DTO、数据库 `(feed_id, guid)` 去重键及每订阅源事务边界。

证据：
- `src-tauri/src/modules/sync/parser.rs` 的 parser builder、链接筛选和规范化逻辑。
- `src-tauri/src/modules/sync/tests.rs` 的 RSS、RDF、Atom、JSON Feed、相对链接和拒绝用例。
- `src/modules/articles/components/ArticleReader.tsx` 的 DOMPurify 清洗后渲染。
