# Graph Report - .  (2026-07-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 206 nodes · 236 edges · 24 communities (16 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `86fd5629`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Chat API & Message Handling|Chat API & Message Handling]]
- [[_COMMUNITY_Graphify CLI & Query Docs|Graphify CLI & Query Docs]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Graphify Extraction Spec|Graphify Extraction Spec]]
- [[_COMMUNITY_Graphify Exports & Analysis|Graphify Exports & Analysis]]
- [[_COMMUNITY_Chat Sidebar & Header UI|Chat Sidebar & Header UI]]
- [[_COMMUNITY_Chat-Bot Request Architecture|Chat-Bot Request Architecture]]
- [[_COMMUNITY_Graphify Incremental Update|Graphify Incremental Update]]
- [[_COMMUNITY_Chat Shell & Page Layout|Chat Shell & Page Layout]]
- [[_COMMUNITY_Graphify Repo Ingestion|Graphify Repo Ingestion]]
- [[_COMMUNITY_Root Layout & Fonts|Root Layout & Fonts]]
- [[_COMMUNITY_Backend Response Parsing|Backend Response Parsing]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Next.js Configuration|Next.js Configuration]]
- [[_COMMUNITY_PostCSS Configuration|PostCSS Configuration]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Next.js Logo Asset|Next.js Logo Asset]]
- [[_COMMUNITY_Vercel Logo Asset|Vercel Logo Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `graphify Skill` - 10 edges
3. `query.md reference (query, path, explain)` - 9 edges
4. `update.md reference (--update, --cluster-only)` - 9 edges
5. `exports.md reference` - 8 edges
6. `AGENTS.md graphify integration section` - 7 edges
7. `Browser -> Next.js -> API Gateway -> Lambda -> AgentCore flow` - 6 edges
8. `app/api/chat/route.ts (BFF proxy)` - 6 edges
9. `ChatShell()` - 5 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md (project root)` --conceptually_related_to--> `Chat Bot UI project (README.md)`  [AMBIGUOUS]
  CLAUDE.md → README.md
- `graphify claude install/uninstall` --conceptually_related_to--> `AGENTS.md graphify integration section`  [INFERRED]
  .codex/skills/graphify/references/hooks.md → AGENTS.md
- `ChatShell()` --calls--> `getChatPaneVisibilityClass()`  [EXTRACTED]
  components/chat-shell.tsx → lib/chat-layout.ts
- `ChatShell()` --calls--> `getShellLayoutClass()`  [EXTRACTED]
  components/chat-shell.tsx → lib/chat-layout.ts
- `ChatShell()` --calls--> `getSidebarVisible()`  [EXTRACTED]
  components/chat-shell.tsx → lib/chat-layout.ts

## Import Cycles
- None detected.

## Communities (24 total, 8 thin omitted)

### Community 0 - "Project Dependencies"
Cohesion: 0.09
Nodes (21): sharp, unrs-resolver, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+13 more)

### Community 1 - "Chat API & Message Handling"
Cohesion: 0.29
Nodes (7): ChatApiClient, isSendMessageResponse(), RestChatApiClient, ChatMessage, ChatRole, SendMessageRequest, SendMessageResponse

### Community 2 - "Graphify CLI & Query Docs"
Cohesion: 0.13
Nodes (23): AGENTS.md graphify integration section, This is NOT the Next.js you know (AGENTS.md rules), CLAUDE.md (project root), add-watch.md reference, graphify.ingest.ingest function, graphify.watch module, graphify claude install/uninstall, hooks.md reference (commit hook + CLAUDE.md integration) (+15 more)

### Community 3 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Graphify Extraction Spec"
Cohesion: 0.20
Nodes (10): Confidence score rubric, extraction-spec.md reference (subagent prompt), Node ID format rule, Honesty Rules, Part C - Merge AST + semantic into final extraction, Step 4 - Build graph, cluster, analyze, generate outputs, Step B0 - Check extraction cache first, Step B1 - Split into chunks (+2 more)

### Community 5 - "Graphify Exports & Analysis"
Cohesion: 0.14
Nodes (14): graphify benchmark (token reduction), exports.md reference, graphify export falkordb, graphify export graphml, graphify.serve MCP stdio server, graphify export neo4j, graphify export svg, graphify export wiki (+6 more)

### Community 6 - "Chat Sidebar & Header UI"
Cohesion: 0.18
Nodes (8): ChatHeaderControls(), ChatHeaderControlsProps, ChatSidebar(), ChatSidebarProps, SIDEBAR_ITEMS, SidebarInfoCardProps, SidebarControlIcon(), SidebarControlIconProps

### Community 7 - "Chat-Bot Request Architecture"
Cohesion: 0.21
Nodes (12): AgentCore simple_langchain_agent, API Gateway (NEXT_PUBLIC_API_BASE_URL), app/api/chat/route.ts (BFF proxy), Browser -> Next.js -> API Gateway -> Lambda -> AgentCore flow, Backend-for-frontend (BFF) proxy rationale, Chat Bot UI project (README.md), components/ (chatbot UI), CORS problem (browser to API Gateway) (+4 more)

### Community 8 - "Graphify Incremental Update"
Cohesion: 0.31
Nodes (9): graphify.build.build_merge function, graphify cluster-only command, graphify.detect.detect_incremental function, update.md reference (--update, --cluster-only), graphify.analyze.graph_diff function, graphify.detect.save_manifest function, --cluster-only flag, Interpreter guard for subcommands (+1 more)

### Community 9 - "Chat Shell & Page Layout"
Cohesion: 0.18
Nodes (8): ChatShell(), ChatFormSubmitEvent, INITIAL_MESSAGES, MainChat(), MainChatProps, getChatPaneVisibilityClass(), getShellLayoutClass(), getSidebarVisible()

### Community 10 - "Graphify Repo Ingestion"
Cohesion: 0.16
Nodes (15): graphify clone command, github-and-merge.md reference, graphify extract CLI, graphify merge-graphs command, transcribe.md reference (video/audio), graphify.transcribe.transcribe_all function, GRAPHIFY_WHISPER_PROMPT domain hint, graphify full pipeline (+7 more)

### Community 11 - "Root Layout & Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 12 - "Backend Response Parsing"
Cohesion: 0.67
Nodes (3): BackendChatBody, isRecord(), parseBackendResponse()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (7): dependencies, @aws-sdk/client-bedrock-agentcore, next, react, react-dom, react-markdown, @tailwindcss/typography

### Community 22 - "Community 22"
Cohesion: 0.47
Nodes (6): Amplify Artifacts Configuration, Amplify Build Phase, Amplify Cache Configuration, Amplify Frontend Build Configuration, pnpm via Corepack Setup Strategy, Amplify preBuild Phase

### Community 23 - "Community 23"
Cohesion: 0.60
Nodes (4): client, isRecord(), parseChatRequest(), POST()

## Ambiguous Edges - Review These
- `CLAUDE.md (project root)` → `Chat Bot UI project (README.md)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **79 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `ChatHeaderControlsProps`, `SIDEBAR_ITEMS` (+74 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CLAUDE.md (project root)` and `Chat Bot UI project (README.md)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `graphify Skill` connect `Graphify CLI & Query Docs` to `Graphify Incremental Update`, `Graphify Repo Ingestion`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `graphify full pipeline` connect `Graphify Repo Ingestion` to `Graphify CLI & Query Docs`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `geistSans`, `geistMono`, `metadata` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Graphify CLI & Query Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._