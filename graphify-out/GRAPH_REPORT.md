# Graph Report - .  (2026-06-30)

## Corpus Check
- Corpus is ~13,295 words - fits in a single context window. You may not need a graph.

## Summary
- 198 nodes · 240 edges · 21 communities (13 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.78)
- Token cost: 479,161 input · 0 output

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
- `Chat Bot UI project (README.md)` --conceptually_related_to--> `CLAUDE.md (project root)`  [AMBIGUOUS]
  README.md → CLAUDE.md
- `graphify claude install/uninstall` --conceptually_related_to--> `AGENTS.md graphify integration section`  [INFERRED]
  .codex/skills/graphify/references/hooks.md → AGENTS.md
- `POST()` --calls--> `createChatMessage()`  [EXTRACTED]
  app/api/chat/route.ts → lib/chat-message.ts
- `ChatShell()` --calls--> `getChatPaneVisibilityClass()`  [EXTRACTED]
  components/chat-shell.tsx → lib/chat-layout.ts
- `ChatShell()` --calls--> `getShellLayoutClass()`  [EXTRACTED]
  components/chat-shell.tsx → lib/chat-layout.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify default build pipeline (Steps 0-9)** — codex_skills_graphify_skill_step1_ensure_installed, codex_skills_graphify_skill_step2_detect_files, codex_skills_graphify_skill_step3_extract, codex_skills_graphify_skill_step4_build_graph, codex_skills_graphify_skill_step5_label_communities, codex_skills_graphify_skill_step6_obsidian_html, codex_skills_graphify_skill_step9_manifest_cost_cleanup [EXTRACTED 1.00]
- **AST + semantic extraction merge flow** — codex_skills_graphify_skill_part_a_structural_extraction, codex_skills_graphify_skill_part_b_semantic_extraction, codex_skills_graphify_skill_part_c_merge_ast_semantic, codex_skills_graphify_references_extraction_spec_doc [EXTRACTED 1.00]
- **Chat request flow: browser to AgentCore** — readme_md_components_ui, readme_md_app_api_chat_route, readme_md_api_gateway, readme_md_lambda, readme_md_agentcore_simple_langchain_agent [EXTRACTED 1.00]

## Communities (21 total, 8 thin omitted)

### Community 0 - "Project Dependencies"
Cohesion: 0.07
Nodes (26): sharp, unrs-resolver, dependencies, @aws-sdk/client-bedrock-agentcore, next, react, react-dom, devDependencies (+18 more)

### Community 1 - "Chat API & Message Handling"
Cohesion: 0.14
Nodes (16): client, isRecord(), parseChatRequest(), POST(), ChatFormSubmitEvent, INITIAL_MESSAGES, MainChat(), MainChatProps (+8 more)

### Community 2 - "Graphify CLI & Query Docs"
Cohesion: 0.13
Nodes (23): AGENTS.md graphify integration section, This is NOT the Next.js you know (AGENTS.md rules), CLAUDE.md (project root), add-watch.md reference, graphify.ingest.ingest function, graphify.watch module, graphify claude install/uninstall, hooks.md reference (commit hook + CLAUDE.md integration) (+15 more)

### Community 3 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Graphify Extraction Spec"
Cohesion: 0.12
Nodes (17): Confidence score rubric, extraction-spec.md reference (subagent prompt), Node ID format rule, transcribe.md reference (video/audio), graphify.transcribe.transcribe_all function, GRAPHIFY_WHISPER_PROMPT domain hint, Honesty Rules, Part A - Structural extraction (AST) (+9 more)

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
Cohesion: 0.50
Nodes (4): ChatShell(), getChatPaneVisibilityClass(), getShellLayoutClass(), getSidebarVisible()

### Community 10 - "Graphify Repo Ingestion"
Cohesion: 0.32
Nodes (8): graphify clone command, github-and-merge.md reference, graphify extract CLI, graphify merge-graphs command, graphify full pipeline, Step 0 - GitHub repos and multi-path merge, Step 1 - Ensure graphify is installed, Step 2 - Detect files

### Community 11 - "Root Layout & Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 12 - "Backend Response Parsing"
Cohesion: 0.67
Nodes (3): BackendChatBody, isRecord(), parseBackendResponse()

## Ambiguous Edges - Review These
- `CLAUDE.md (project root)` → `Chat Bot UI project (README.md)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **76 isolated node(s):** `client`, `geistSans`, `geistMono`, `metadata`, `ChatHeaderControlsProps` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CLAUDE.md (project root)` and `Chat Bot UI project (README.md)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `graphify Skill` connect `Graphify CLI & Query Docs` to `Graphify Incremental Update`, `Graphify Repo Ingestion`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `graphify full pipeline` connect `Graphify Repo Ingestion` to `Graphify CLI & Query Docs`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `client`, `geistSans`, `geistMono` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Chat API & Message Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.13538461538461538 - nodes in this community are weakly interconnected._
- **Should `Graphify CLI & Query Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.13043478260869565 - nodes in this community are weakly interconnected._