# 前端数据、状态与 IPC 校验接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Zod、Zustand、TanStack Query 直接接入 Feed Forge，并将现有 IPC 返回校验、异步数据与跨面板阅读选择完整迁移到各自职责边界。

**Architecture:** 各业务 `ipc.ts` 接收 `unknown` 并使用本业务 Zod schema 校验；React Query 按业务 key 缓存 IPC 查询及管理 mutation；Zustand 只保存阅读选择与筛选，页面不复制服务端/本地数据库记录。同步 Channel 保留独立 hook，只有有效且属于本次任务的完成、失败或取消终态才失效查询，提示仍区分三种状态。

**Tech Stack:** pnpm、React 19、TypeScript、Tauri v2、Zod 4、Zustand 5、TanStack Query 5、Vitest 5、React Testing Library。

**Spec:** `docs/superpowers/specs/2026-09-13-frontend-data-state-integration-design.md`

## Global Constraints

- 开工时先读本计划、Spec、`docs/testing-strategy.md`、当前 Git 状态及目标文件；保留并适配用户在执行期间的新改动。
- 当前仓库只使用 pnpm；Rust 命令显式传 `--manifest-path src-tauri/Cargo.toml`。
- 不修改 Rust command 名称、IPC 输入输出协议、capability 或 Tauri 权限；不新建通用 IPC dispatcher、事件总线或持久化 Query 缓存。Rust 逐项提交同步结果，故有效失败/取消终态也可能需要刷新已写入的数据。
- Zod schema 与当前 Rust DTO 字段对应；对象容忍额外字段；无效成功返回值为不可重试、固定安全文案的 `IpcError`；mutation 响应无效仍重新查询可能已变更的数据。
- Query 仅存 IPC 异步数据；Zustand 仅存阅读选择/筛选；设置草稿、OPML 输入、同步进度、侧栏折叠保留局部状态。
- 先写行为测试并观察正确的失败，再写最小实现；需要更改测试时遵守 `superpowers:test-driven-development/writing-good-tests.md` 与 `docs/testing-strategy.md`。
- 不自动提交、推送或创建 PR；本计划中没有 Git commit 步骤。每段完成后运行对应定向测试和 `pnpm build`，最终运行 Spec 的完整验收命令。

## File/Interface Map

| 文件 | 唯一责任 |
| --- | --- |
| `src/lib/ipc/parse.ts`、`src/lib/ipc/errors.ts` | 解析返回值与安全归一化拒绝错误 |
| `src/modules/{feeds,articles,settings,opml,sync}/schema.ts` | Rust DTO 对应的 Zod schema；`types.ts` 只导出 schema 推导类型与输入类型 |
| 各业务 `ipc.ts` | 保持现有 wire name/参数，先捕获调用拒绝、后解析成功 `unknown` 值 |
| `src/lib/query/client.ts` | QueryClient 默认选项与测试可创建的隔离实例 |
| `src/modules/{feeds,articles,settings}/keys.ts` | 本模块的稳定查询 key |
| `src/modules/{feeds,articles,settings}/hooks/*` | IPC 查询、mutation 与失效，不复制服务端状态 |
| `src/modules/opml/hooks/useOpml.ts` | 导入/导出 mutation、导入后的 feeds 失效 |
| `src/modules/sync/hooks/useSync.ts` | 本次 job 的 Channel 状态与有效终态后的 feeds/articles 失效 |
| `src/modules/reader/store.ts`、`src/modules/reader/pages/ReaderPage.tsx` | 跨面板 UI 选择；从原 `App.tsx` 迁出的业务组合 |
| `src/App.tsx` | 每次应用挂载独立、稳定的 QueryClientProvider 与 ReaderPage |

---

### Task 1: 安装直接依赖并建立安全解析/feeds 契约

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/lib/ipc/errors.ts`, `src/modules/feeds/ipc.ts`, `src/modules/feeds/types.ts`, `src/modules/feeds/__tests__/ipc.test.ts`
- Create: `src/lib/ipc/parse.ts`, `src/lib/ipc/parse.test.ts`, `src/modules/feeds/schema.ts`

**Interfaces:**
- Produces: `parseIpcResult<S extends z.ZodType>(schema: S, raw: unknown): z.output<S>`；`feedSummarySchema`、`feedListSchema`、`removedFeedSchema`；`FeedSummary = z.infer<typeof feedSummarySchema>`；`IpcError` 的 `code: "invalid_response"` 固定文案为 `桌面返回的数据格式无效。`。
- Consumes: 当前 `normalizeIpcError(error: unknown): IpcError` 和 `feeds_*` command 的原有参数。

- [ ] **Step 1: 准备测试依赖。** 运行 `pnpm add zod@^4 zustand@^5 @tanstack/react-query@^5`；只核对 `package.json` 和 `pnpm-lock.yaml` 增量，不升级其他包。
- [ ] **Step 2: 写先失败的解析与 feeds IPC 测试。** 在 `src/lib/ipc/parse.test.ts` 测 `parseIpcResult(z.object({ id: z.number() }), { id: "7" })` 抛 `IpcError`，`code === "invalid_response"`、`retryable === false` 且错误文本不包含原始输入；在 feeds IPC 测完整字段的返回、缺少 `siteUrl` 返回及缺少 `retryable` 的拒绝错误：

```ts
const feed = {
  id: 7, title: "Example", url: "https://example.com/feed.xml",
  siteUrl: null, description: null, lastSyncedAt: null, syncError: null,
};
mockIPC((command, payload) => {
  if (command !== "feeds_add") throw new Error(`Unexpected IPC command: ${command}`);
  expect(payload).toEqual({ input: { url: feed.url } });
  return { ...feed, siteUrl: undefined };
});
await expect(addFeed(feed.url)).rejects.toMatchObject({
  code: "invalid_response", retryable: false,
  message: "桌面返回的数据格式无效。",
});
```

- [ ] **Step 3: 验证 RED。** 运行 `pnpm exec vitest run src/lib/ipc/parse.test.ts src/modules/feeds/__tests__/ipc.test.ts`；确认失败指向缺少解析或接受了畸形 DTO，而不是 Tauri mock 的未知命令。既有 feeds 正例 `feeds_add`/`feeds_update` 的 `{}`、不完整字段桩在 Step 2 写测试时就补成完整 `feed`，否则旧正例无法代表真实返回。
- [ ] **Step 4: 最小实现。** `parseIpcResult` 用 `schema.safeParse(raw)`，失败时仅构造 `new IpcError({ code: "invalid_response", message: "桌面返回的数据格式无效。", retryable: false })`；`normalizeIpcError` 对结构化拒绝校验三个必需字段的类型，不合格则回退现有 `internal` 安全文案。feeds schema 按当前 Rust `FeedSummary` 七字段构造 `z.object`；ID 为正安全整数；`siteUrl`、`description`、`lastSyncedAt`、`syncError` 为 `z.string().nullable()`；列表 `z.array(feedSummarySchema)`；删除返回 `{ feedId: positiveId }`。每个 feeds facade 先独立 `try/catch` 调用 `invoke<unknown>`，再于 catch 外调用 `parseIpcResult(schema, raw)`，防止把校验错误二次归一化成 `internal`。

```ts
export function parseIpcResult<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  throw new IpcError({
    code: "invalid_response", message: "桌面返回的数据格式无效。", retryable: false,
  });
}

export async function listFeeds(): Promise<FeedSummary[]> {
  let raw: unknown;
  try { raw = await invoke<unknown>("feeds_list", { input: {} }); }
  catch (error) { throw normalizeIpcError(error); }
  return parseIpcResult(feedListSchema, raw);
}
```
- [ ] **Step 5: 验证 GREEN。** 运行上一步定向测试、`pnpm build`、`git diff --check`，检查 feeds 四个 wire name/参数未变且 schema 不包含敏感 payload。

### Task 2: articles、settings、OPML 返回契约

**Files:**
- Create: `src/modules/articles/schema.ts`, `src/modules/settings/schema.ts`, `src/modules/opml/schema.ts`
- Modify: 这三模块各自的 `types.ts`、`ipc.ts`、`__tests__/ipc.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `parseIpcResult` 和 `IpcError`。
- Produces: `articleSchema`、`articlePageSchema`、`settingsSchema`、`opmlImportResultSchema`；各模块从 schema 推导的 `ArticleSummary`、`ArticlePage`、`Settings`、`OpmlImportResult`。原 `ArticleFilter = "all" | "unread" | "starred"` 不变。

- [ ] **Step 1: 给三个业务写失败用例。** `articles_list` 返回 `{ items: [{ id: "bad" }], total: 1 }` 必须拒绝，读取/星标 mutation 的完整 article 返回通过，`settings_get` 的 `theme: "unknown"` 拒绝，`settings_update` 的完整设置通过，`opml_import` 的 `imported: -1` 拒绝，`opml_export` 的非字符串返回拒绝。原有 `articles_mark_read`、`articles_toggle_star` 的 `{}` 正例和不完整订阅源正例改为当前 Rust DTO 全字段桩：

```ts
const article = {
  id: 11, feedId: 7, guid: "11", url: null, title: "文章", author: null,
  summary: null, content: null, publishedAt: null, isRead: false, isStarred: false,
};
const settings = { refreshIntervalMinutes: 60, theme: "system" as const, openLinksInBrowser: true };
mockIPC((command) => {
  if (command === "articles_list") return { items: [{ ...article, id: "bad" }], total: 1 };
  throw new Error(`Unexpected IPC command: ${command}`);
});
await expect(listArticles({ feedId: 7, filter: "all", limit: 100, offset: 0 }))
  .rejects.toMatchObject({ code: "invalid_response" });
```

- [ ] **Step 2: 验证 RED。** 运行 `pnpm exec vitest run src/modules/articles/__tests__/ipc.test.ts src/modules/settings/__tests__/ipc.test.ts src/modules/opml/__tests__/ipc.test.ts`；失败必须是畸形数据仍被接受。
- [ ] **Step 3: 实现三个 schema 与 facade。** articles 的 ID/feedId 为正安全整数，分页 `total` 为非负安全整数，字符串/null/布尔字段逐一按 Rust DTO 定义；settings interval 为 1..1440 整数、theme `z.enum(["system", "light", "dark"])`、外部链接布尔值；OPML 计数非负安全整数，导出 `z.string()`。现有每个 `invoke<T>` 改为调用 `invoke<unknown>`，catch 只处理拒绝，成功值用对应 schema 解析；保留参数原样及既有 `types.ts` 导出名。

```ts
export const settingsSchema = z.object({
  refreshIntervalMinutes: z.number().int().min(1).max(1440),
  theme: z.enum(["system", "light", "dark"]),
  openLinksInBrowser: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

export async function getSettings(): Promise<Settings> {
  let raw: unknown;
  try { raw = await invoke<unknown>("settings_get", { input: {} }); }
  catch (error) { throw normalizeIpcError(error); }
  return parseIpcResult(settingsSchema, raw);
}
```
- [ ] **Step 4: 验证 GREEN。** 重跑三组定向测试和 `pnpm build`；断言错误结果不含畸形 DTO 字段、wire 参数与原测试一致。

### Task 3: 同步确认结果与 Channel 消息校验

**Files:**
- Create: `src/modules/sync/schema.ts`
- Modify: `src/modules/sync/types.ts`, `src/modules/sync/ipc.ts`, `src/modules/sync/__tests__/ipc.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `parseIpcResult` 与 `IpcError`。
- Produces: `startSync(feedId: number | undefined, onEvent: (event: SyncEvent) => void, onInvalidEvent: (error: IpcError) => void): Promise<SyncAccepted>`、`cancelSync(jobId: number): Promise<SyncAccepted>`；`SyncEvent` 为 Zod 判别联合推导类型。

- [ ] **Step 1: 写 Channel 行为失败测试。** 使用现有 `mockIPC` 精确识别 `sync_start` 和 `sync_cancel`；取 `payload.onEvent as Channel<unknown>` 并调用其 `onmessage` 注入消息。测试 `completed` 的正确 jobId 被转发、畸形 `processed: "1"` 和不同 jobId 不被转发并各触发一次 `invalid_response`、命令确认值 `{jobId:"bad"}` 被拒绝；另测试在 mock handler 返回确认之前先发终态，确认后仍正确转发：

```ts
mockIPC((command, payload) => {
  if (command !== "sync_start") throw new Error(`Unexpected IPC command: ${command}`);
  expect(payload.input).toEqual({ feedId: undefined });
  (payload.onEvent as Channel<unknown>).onmessage({
    event: "completed", data: { jobId: 9, processed: 1 },
  });
  return { jobId: 9 };
});
const events: SyncEvent[] = [];
const errors: IpcError[] = [];
await startSync(undefined, (event) => events.push(event), (error) => errors.push(error));
expect(events).toEqual([{ event: "completed", data: { jobId: 9, processed: 1 } }]);
expect(errors).toEqual([]);
```

- [ ] **Step 2: 验证 RED。** `pnpm exec vitest run src/modules/sync/__tests__/ipc.test.ts` 应因缺少校验/第三回调或畸形消息被转发而失败。
- [ ] **Step 3: 实现。** sync schema 使用 `z.discriminatedUnion("event", [...])` 描述五种精确终态及非负计数/正整数 jobId；`Channel<unknown>` 的 `onmessage` 先 `safeParse`，错误回调收到安全 `IpcError` 而不是抛异常。确认结果采用 `parseIpcResult(syncAcceptedSchema, raw)`，确认之前缓存已验证消息，确认后逐条对照 `event.data.jobId === accepted.jobId` 再送回调；不匹配视为 `invalid_response`，失败的命令丢弃缓冲消息。取消返回同一确认 schema。不要新增未使用的 `sync_status` facade。

```ts
const pending: SyncEvent[] = [];
let acceptedJobId: number | undefined;
const channel = new Channel<unknown>((raw) => {
  const parsed = syncEventSchema.safeParse(raw);
  if (!parsed.success) { onInvalidEvent(invalidResponseError()); return; }
  const event = parsed.data;
  if (acceptedJobId === undefined) { pending.push(event); return; }
  if (event.data.jobId !== acceptedJobId) { onInvalidEvent(invalidResponseError()); return; }
  onEvent(event);
});
let raw: unknown;
try { raw = await invoke<unknown>("sync_start", { input: { feedId }, onEvent: channel }); }
catch (error) { throw normalizeIpcError(error); }
const accepted = parseIpcResult(syncAcceptedSchema, raw);
acceptedJobId = accepted.jobId;
for (const event of pending) {
  if (event.data.jobId === accepted.jobId) onEvent(event);
  else onInvalidEvent(invalidResponseError());
}
return accepted;
```
- [ ] **Step 4: 验证 GREEN。** 重跑同步 facade 测试及 `pnpm build`；确认同步五种消息类型和取消原 wire 参数不变。

### Task 4: QueryClient 与 feeds 异步数据/mutation

**Files:**
- Create: `src/lib/query/client.ts`, `src/lib/query/client.test.ts`, `src/modules/feeds/keys.ts`, `src/modules/feeds/__tests__/useFeeds.test.tsx`
- Modify: `src/App.tsx`, `src/modules/feeds/hooks/useFeeds.ts`, `src/App.test.tsx`

**Interfaces:**
- Produces: `createAppQueryClient(): QueryClient`；`feedKeys.all = ["feeds"] as const`、`feedKeys.list = ["feeds", "list"] as const`；`useFeeds()` 保持 `{ feeds, loading, error, refresh, create, rename, remove }` 供原 App 使用。
- Consumes: Task 1 的四个已校验 feeds facade；Task 2/3 原业务组件在此任务保持现状。

- [ ] **Step 1: 写 Query 行为失败测试。** 用独立 `QueryClientProvider` 包裹 `renderHook(useFeeds)`、`mockIPC` 精确响应 `feeds_list`/`feeds_add`/`feeds_update`/`feeds_remove`。断言两个消费者共享一次活动订阅列表查询；添加后在列表看到完整新增 feed；重命名后显示新标题；删除后不再显示原 feed；模拟 `feeds_add` 返回无效 DTO 时 promise 拒绝但 feeds 被再次请求以恢复真实状态。另测试 QueryClient 对 `IpcError({ retryable:false })` 不重试、对 `retryable:true` 最多重试一次，默认不因窗口聚焦重新请求。

```tsx
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const { result } = renderHook(() => useFeeds(), { wrapper });
await waitFor(() => expect(result.current.feeds).toHaveLength(1));
const second = renderHook(() => useFeeds(), { wrapper });
await waitFor(() => expect(second.result.current.feeds).toHaveLength(1));
expect(listCalls).toBe(1);
await act(async () => { await result.current.rename(7, "新标题"); });
await waitFor(() => expect(result.current.feeds[0]?.title).toBe("新标题"));
```

- [ ] **Step 2: 验证 RED。** `pnpm exec vitest run src/lib/query/client.test.ts src/modules/feeds/__tests__/useFeeds.test.tsx` 应因没有 QueryClient 配置、旧 hook 不共享缓存/无效成功响应后的恢复行为而失败；若原测试无 Provider 就意外通过，改用两个消费者的缓存断言。
- [ ] **Step 3: 实现。** `createAppQueryClient()` 使用 `new QueryClient({defaultOptions:{queries:{staleTime:30_000,refetchOnWindowFocus:false,refetchOnReconnect:false,retry:(failureCount,error)=>failureCount<1 && error instanceof IpcError && error.retryable},mutations:{retry:false}}})`。在 `App.tsx` 用 `useState(createAppQueryClient)` 为每次挂载创建稳定实例，包围当前页面内容；本任务可将原业务内容临时保留为同文件 `AppContent`，Task 7 再迁出。`useFeeds` 改用 `useQuery({queryKey:feedKeys.list,queryFn:listFeeds})` 和三个 `useMutation`；成功写入先维护 feeds key 的可见数据，并用非阻塞 `invalidateQueries({queryKey:feedKeys.all})` 读取权威列表；mutation `onSettled` 无论成功还是错误均触发同范围失效，尤其涵盖响应畸形但 Rust 已写入的情形。公开方法封装 `mutateAsync`，Query 后台刷新失败不改变已成功的 mutation Promise 结果。

```tsx
function App() {
  const [queryClient] = useState(createAppQueryClient);
  return <QueryClientProvider client={queryClient}><AppContent /></QueryClientProvider>;
}

const list = useQuery({ queryKey: feedKeys.list, queryFn: listFeeds });
const add = useMutation({
  mutationFn: addFeed,
  onSuccess: (feed) => queryClient.setQueryData<FeedSummary[]>(feedKeys.list, (current) =>
    current ? [...current, feed].sort((a, b) => a.title.localeCompare(b.title)) : current),
  onSettled: () => { void queryClient.invalidateQueries({ queryKey: feedKeys.all }); },
});
```
- [ ] **Step 4: 验证 GREEN。** 重跑 Task 4 测试、`src/App.test.tsx`、`pnpm build`。检查所有 App 测试新 QueryClient 按 render 隔离，页面原有加载/错误/弹窗行为仍成立。

### Task 5: articles 查询、筛选缓存和 settings 保存

**Files:**
- Create: `src/modules/articles/keys.ts`, `src/modules/settings/keys.ts`, `src/modules/articles/__tests__/useArticles.test.tsx`, `src/modules/settings/__tests__/useSettings.test.tsx`
- Modify: `src/modules/articles/hooks/useArticles.ts`, `src/modules/settings/hooks/useSettings.ts`, `src/modules/feeds/hooks/useFeeds.ts`, `src/App.test.tsx`

**Interfaces:**
- Produces: `articleKeys.all=["articles"] as const`、`articleKeys.feed(id: number)=["articles",id] as const`、`articleKeys.list(id: number | undefined,filter: ArticleFilter)=["articles",id,filter,100,0] as const`；`settingsKeys.all=["settings"] as const`；`useArticles(feedId,filter)` 保持 `{ items,total,loading,error,refresh,setRead,setStarred }`；`useSettings()` 保持 `{ settings,loading,error,save }`。
- Consumes: Task 4 的 QueryClient/feeds hook；Task 2 的校验后 article、settings facades。

- [ ] **Step 1: 写失败的业务行为测试。** `mockIPC` 为 `articles_list` 记录完整输入；传 `feedId=undefined` 时不调用列表 command，切到 `7/unread` 后调用 `{feedId:7,filter:"unread",limit:100,offset:0}`，再切 `starred` 得到独立结果；read/star mutation 成功后 `unread` 与 `starred` 的活动查询可重新加载匹配结果及 `total`；无效 mutation 返回后也重新读取。`settings_get` 加载后保存成功应立即表现新的 theme/刷新间隔，保存失败保留旧缓存与草稿；测试暗色类与定时器变化/卸载清理，不使用固定延时。当前 App 测试保留用户可见断言。

```tsx
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) =>
  <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const { result, rerender } = renderHook(({ id, filter }) => useArticles(id, filter), {
  initialProps: { id: undefined as number | undefined, filter: "unread" as ArticleFilter },
  wrapper,
});
expect(articleListCalls).toBe(0);
rerender({ id: 7, filter: "unread" });
await waitFor(() => expect(articleListCalls).toBe(1));
expect(lastListInput).toEqual({ feedId: 7, filter: "unread", limit: 100, offset: 0 });
```
- [ ] **Step 2: 验证 RED。** `pnpm exec vitest run src/modules/articles/__tests__/useArticles.test.tsx src/modules/settings/__tests__/useSettings.test.tsx src/App.test.tsx`；新测试须因缺少键控缓存/重查行为失败，不以缺少 `QueryClientProvider` 的配置错误充当 RED。
- [ ] **Step 3: 实现。** articles `useQuery({queryKey:articleKeys.list(feedId,filter),queryFn:()=>listArticles({feedId,filter,limit:100,offset:0}),enabled:feedId!==undefined})`；无 feed 时返回 `{items:[],total:0,loading:false}`，切 key 时不使用前一订阅源的 `placeholderData`。两个 mutation 在 `onSettled` 失效 `articleKeys.feed(feedId)`，非阻塞，保持返回 `Promise<ArticleSummary>`，组件需能观察并显示更新错误。settings `useQuery` 加载、`useMutation` 保存，成功时 `queryClient.setQueryData(settingsKeys.all,saved)`；如果错误为 `invalid_response` 则失效 settings key。主题 effect 从已校验的 settings 数据读取并保留 `matchMedia` 监听清理。feeds 删除成功时额外 `queryClient.removeQueries({queryKey:articleKeys.feed(feedId)})`，但不可把删除请求失败当成功清理。

```ts
const list = useQuery({
  queryKey: articleKeys.list(feedId, filter),
  queryFn: () => listArticles({ feedId, filter, limit: 100, offset: 0 }),
  enabled: feedId !== undefined,
});
const read = useMutation({
  mutationFn: ({ articleId, isRead }: { articleId: number; isRead: boolean }) =>
    markArticleRead(articleId, isRead),
  onSettled: () => {
    if (feedId !== undefined) void queryClient.invalidateQueries({ queryKey: articleKeys.feed(feedId) });
  },
});
const settingsUpdate = useMutation({
  mutationFn: updateSettings,
  onSuccess: (saved) => queryClient.setQueryData(settingsKeys.all, saved),
  onSettled: (_data, error) => {
    if (error instanceof IpcError && error.code === "invalid_response")
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
  },
});
```
- [ ] **Step 4: 验证 GREEN。** 重跑定向 hook 与 App 测试、`pnpm build`，检查筛选的 query key、文章分页总数、settings 草稿和自动刷新定时器。

### Task 6: OPML 导入/导出与同步终态接入缓存

**Files:**
- Create: `src/modules/opml/hooks/useOpml.ts`, `src/modules/opml/__tests__/useOpml.test.tsx`, `src/modules/sync/__tests__/useSync.test.tsx`
- Modify: `src/modules/opml/components/OpmlTools.tsx`, `src/modules/settings/components/SettingsDialog.tsx`, `src/modules/sync/hooks/useSync.ts`, `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Produces: `useOpml()` 的 `importContent(content: string): Promise<OpmlImportResult>` 和 `exportContent(): Promise<string>`；`useSync()` 保持 `{event,jobId,error,start,cancel}`。`SettingsDialog`/`OpmlTools` 删除 `onImported` prop；订阅和设置其他 props 保留。
- Consumes: Task 3 的 `startSync(feedId,onEvent,onInvalidEvent)`、Task 4/5 的三类 query keys。

- [ ] **Step 1: 写失败测试。** OPML mock 对 `opml_import` 返回 `{imported:1,skipped:0}` 后下一次 `feeds_list` 返回两项，断言 UI 显示新订阅与已导入提示；畸形计数时不显示成功提示但查询仍重新请求；导出后不失效 feeds。同步测试用 `mockIPC` 捕获 `Channel<unknown>`：当前 jobId 的有效 `completed`、已有 `progress` 后的 `failed`、已有 `progress` 后的 `canceled` 分别让 feeds/articles 再次查询且各只触发一次终态刷新；失败和取消保持对应提示而不报告成功。畸形终态、不同 jobId 和新 start 后旧 job 的终态均不刷新，也不更新新任务状态；无效中间消息之后到来的有效失败终态应覆盖此前协议错误并显示真实失败状态。

```tsx
await userEvent.click(screen.getByRole("button", { name: "导入" }));
expect(await screen.findByRole("status")).toHaveTextContent("已导入 1 个订阅源，跳过 0 个");
await waitFor(() => expect(screen.getByRole("list", { name: "订阅源" }))
  .toHaveTextContent("新订阅"));
```

```tsx
const feed = {
  id: 7, title: "OpenAI", url: "https://example.com/feed.xml",
  siteUrl: null, description: null, lastSyncedAt: null, syncError: null,
};
const settings = { refreshIntervalMinutes: 60, theme: "system", openLinksInBrowser: true };
let feedsListCalls = 0;
let articlesListCalls = 0;
let channel!: Channel<unknown>;
mockIPC((command, payload) => {
  if (command === "feeds_list") { feedsListCalls++; return [feed]; }
  if (command === "articles_list") { articlesListCalls++; return { items: [], total: 0 }; }
  if (command === "settings_get") return settings;
  if (command === "sync_start") {
    channel = (payload as { onEvent: Channel<unknown> }).onEvent;
    return { jobId: 9 };
  }
  throw new Error(`Unexpected IPC command: ${command}`);
});
render(<App />);
await userEvent.click(await screen.findByRole("button", { name: /OpenAI/ }));
await waitFor(() => expect(articlesListCalls).toBe(1));
await userEvent.click(screen.getByRole("button", { name: "刷新" }));
await waitFor(() => expect(channel).toBeDefined());
const feedsBefore = feedsListCalls;
const articlesBefore = articlesListCalls;
channel.onmessage({ event: "progress", data: { jobId: 9, processed: 1, total: 2 } });
channel.onmessage({ event: "failed", data: { jobId: 9, message: "同步失败" } });
await waitFor(() => expect(feedsListCalls).toBe(feedsBefore + 1));
await waitFor(() => expect(articlesListCalls).toBe(articlesBefore + 1));
expect(screen.queryByText(/同步完成/)).not.toBeInTheDocument();
expect(screen.getByRole("alert")).toHaveTextContent("同步失败");
```
- [ ] **Step 2: 验证 RED。** `pnpm exec vitest run src/modules/opml/__tests__/useOpml.test.tsx src/modules/sync/__tests__/useSync.test.tsx src/App.test.tsx`；失败必须对应有效失败/取消终态的失效或旧 job 防护缺失。
- [ ] **Step 3: 实现。** `useOpml` 为导入/导出各建 `useMutation`；导入 `onSettled` 非阻塞失效 `feedKeys.all`（包括响应畸形），导出不变动缓存；`OpmlTools` 仍在本地处理 Blob、链接与 busy 状态。`useSync` 维持本次启动的 generation token；收到过时 Channel 回调直接忽略；`onInvalidEvent` 仅在当前任务尚未终结时更新安全的错误状态，不能失效缓存。当前任务首次收到合法 `completed`、`failed` 或 `canceled` 终态时调用 `void queryClient.invalidateQueries({queryKey:feedKeys.all})` 和 articles 同范围失效，并保留终态对应 UI 文案，不把失败或取消报告成成功；终态后忽略该任务的后续消息，避免重复刷新或覆盖提示。不要改 Rust/权限。App 移除旧 `sync.event` 手动 refresh effect，SettingsDialog 移除 `onImported` 参数和转发。

```ts
const importMutation = useMutation({
  mutationFn: importOpml,
  onSettled: () => { void queryClient.invalidateQueries({ queryKey: feedKeys.all }); },
});
const exportMutation = useMutation({ mutationFn: exportOpml });
const importContent = (content: string) => importMutation.mutateAsync(content);
const exportContent = () => exportMutation.mutateAsync();

const generation = ++generationRef.current;
const onInvalidEvent = (error: IpcError) => {
  if (generationRef.current === generation && terminalGenerationRef.current !== generation)
    setError(error.message);
};
const onEvent = (event: SyncEvent) => {
  if (generationRef.current !== generation) return;
  if (terminalGenerationRef.current === generation) return;
  const isTerminal = event.event === "completed" || event.event === "failed" || event.event === "canceled";
  if (isTerminal) setError(null);
  setEvent(event);
  if (isTerminal) {
    terminalGenerationRef.current = generation;
    void queryClient.invalidateQueries({ queryKey: feedKeys.all });
    void queryClient.invalidateQueries({ queryKey: articleKeys.all });
  }
};
```
- [ ] **Step 4: 验证 GREEN。** 重跑 Task 6 测试和 App 测试、`pnpm build`；确认定时器调用 `sync.start()` 与手动按钮行为不变、导入 busy 弹窗不会提前关闭。

### Task 7: Zustand 阅读选择与页面收口

**Files:**
- Create: `src/modules/reader/store.ts`, `src/modules/reader/store.test.ts`, `src/modules/reader/pages/ReaderPage.tsx`, `src/modules/reader/pages/ReaderPage.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/modules/articles/components/ArticleList.tsx`（仅将 `onSelect` 传递值由 article 对象改为 `article.id`，不改显示）

**Interfaces:**
- Produces: `useReaderStore` 的状态 `selectedFeedId?: number`、`selectedArticleId?: number`、`filter: ArticleFilter`；actions `selectFeed(feedId)`、`selectArticle(articleId)`、`setFilter(filter)`、`clearFeedIfSelected(feedId)`、`clearMissingFeed(ids)`、`clearMissingArticle(ids)`；`ReaderPage` 无 props。`App` 只创建 Provider 并渲染 `ReaderPage`。
- Consumes: Tasks 4–6 的业务 hooks，Task 5 的 articles 键控缓存，现有三个栏、设置弹窗和同步进度 UI。

- [ ] **Step 1: 写失败测试。** Store 测选择订阅源/切换筛选清空文章、删除当前订阅源清空双选择、删除非当前订阅源保留选择。页面测试以真实组件+Tauri mock 为边界：打开订阅源并点文章后切换筛选或订阅源不显示旧阅读器；刷新后按选中 ID 显示最新文章对象；已读文章从 `unread` 结果消失时不保留旧详情；feeds 查询失败不能清除现有选择，成功返回缺少当前 feed 才能清理；读取/收藏失败出现安全 alert。其他 App 现有弹窗、三栏折叠、窗口操作与主题测试继续作为回归。

```ts
useReaderStore.getState().selectFeed(7);
useReaderStore.getState().selectArticle(11);
useReaderStore.getState().setFilter("unread");
expect(useReaderStore.getState()).toMatchObject({
  selectedFeedId: 7, selectedArticleId: undefined, filter: "unread",
});
```

- [ ] **Step 2: 验证 RED。** `pnpm exec vitest run src/modules/reader/store.test.ts src/modules/reader/pages/ReaderPage.test.tsx src/App.test.tsx`；失败应对应没有 store/仍保留旧文章对象，不以测试 wrapper/未知 Tauri command 为理由。每个 store 相关测试结束使用测试侧 `useReaderStore.setState({selectedFeedId:undefined,selectedArticleId:undefined,filter:"all"})`，不要为测试新增生产 `reset()`。
- [ ] **Step 3: 实现 store 与页面。** `create<ReaderState>()((set)=>({...}))`；页面只用 selector 读取所需字段和 action；侧栏折叠/窄窗口 hook 保留在页面本地。从 `src/App.tsx` 移出现有 JSX/业务 effect 到 `ReaderPage`，App 仅输出 Provider/ReaderPage。`ArticleList.onSelect(article.id)`；页面用 `items.find(item=>item.id===selectedArticleId)` 派生阅读对象，query 失败或进行中不当成空列表执行清理；仅在成功且当前 ID 不存在时 `clearMissingArticle`。删除操作 `await remove(feedId)` 成功后 `clearFeedIfSelected(feedId)`；mutation 返回 `invalid_response` 时不报告成功，仅在权威 feeds 重取确认缺项后再清理。列表可见 query error 与文章 mutation 错误分开显示。

```tsx
export const useReaderStore = create<ReaderState>()((set) => ({
  selectedFeedId: undefined,
  selectedArticleId: undefined,
  filter: "all",
  selectFeed: (feedId) => set({ selectedFeedId: feedId, selectedArticleId: undefined }),
  selectArticle: (articleId) => set({ selectedArticleId: articleId }),
  setFilter: (filter) => set({ filter, selectedArticleId: undefined }),
  clearFeedIfSelected: (feedId) => set((state) => state.selectedFeedId === feedId
    ? { selectedFeedId: undefined, selectedArticleId: undefined } : state),
  clearMissingFeed: (ids) => set((state) => state.selectedFeedId !== undefined && !ids.includes(state.selectedFeedId)
    ? { selectedFeedId: undefined, selectedArticleId: undefined } : state),
  clearMissingArticle: (ids) => set((state) => state.selectedArticleId !== undefined && !ids.includes(state.selectedArticleId)
    ? { selectedArticleId: undefined } : state),
}));

const selectedFeedId = useReaderStore((state) => state.selectedFeedId);
const selectedArticleId = useReaderStore((state) => state.selectedArticleId);
const selectedArticle = items.find((article) => article.id === selectedArticleId);
```
- [ ] **Step 4: 验证 GREEN。** 重跑 Task 7、所有 App 及现有组件测试，运行 `pnpm build`；检查 `ReaderPage` 对同一 article 只引用 ID、不产生第二份缓存，删除/切换状态符合测试。
- [ ] **Step 5: 完整验收。** 运行 `pnpm test:all`、`pnpm test:coverage`、`pnpm build`、`cargo check --manifest-path src-tauri/Cargo.toml`、`git diff --check`，检查 `git status --short`、依赖锁文件增量、测试结果和新增文件尾随空白。对打包运行时未覆盖场景如实报告；除非测试路线图触发条件新增，否则不改 `docs/testing-strategy.md`。不要提交或推送。

## Review gates

每个 Task 的失败测试必须真实运行并确认失败原因；成功后仅进入下一 Task，不把仅 mock 通过当作桌面运行时通过。完成 Task 3 核对 13 个已使用 command 返回 schema 与五种 Channel 消息；完成 Task 6 核对 mutation 的成功/畸形响应及失效语义，并验证完成、失败、取消的有效终态刷新，畸形或旧任务终态不刷新；完成 Task 7 核对选择状态只有 ID、客户端状态不会复制 Query 数据。执行期间若发现 Rust DTO 与本设计不一致，先停下来核对当前代码与需求，避免为通过测试而默默改变 IPC 协议。
