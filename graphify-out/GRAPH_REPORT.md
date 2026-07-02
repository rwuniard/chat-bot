# Graph Report - .  (2026-07-02)

## Corpus Check
- 22 files · ~16,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 249 nodes · 298 edges · 25 communities (16 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.83)
- Token cost: 0 input · 74,945 output

## Community Hubs (Navigation)
- [[_COMMUNITY_graphify Skill & Tooling|graphify Skill & Tooling]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_graphify Export Formats|graphify Export Formats]]
- [[_COMMUNITY_Main Chat Component|Main Chat Component]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Chat API Route (Streaming)|Chat API Route (Streaming)]]
- [[_COMMUNITY_Chat Shell & Layout Pages|Chat Shell & Layout Pages]]
- [[_COMMUNITY_graphify CLI Commands|graphify CLI Commands]]
- [[_COMMUNITY_Auth Routes & Cognito Client|Auth Routes & Cognito Client]]
- [[_COMMUNITY_Chat Bot Architecture Overview|Chat Bot Architecture Overview]]
- [[_COMMUNITY_Amplify Build Pipeline|Amplify Build Pipeline]]
- [[_COMMUNITY_HeaderSidebar Controls|Header/Sidebar Controls]]
- [[_COMMUNITY_Root Layout & Fonts|Root Layout & Fonts]]
- [[_COMMUNITY_Backend Response Parsing|Backend Response Parsing]]
- [[_COMMUNITY_Auth Proxy Middleware|Auth Proxy Middleware]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
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
9. `POST()` - 5 edges
10. `signAuthToken()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md (project root)` --conceptually_related_to--> `Chat Bot UI project (README.md)`  [AMBIGUOUS]
  CLAUDE.md → README.md
- `graphify claude install/uninstall` --conceptually_related_to--> `AGENTS.md graphify integration section`  [INFERRED]
  .codex/skills/graphify/references/hooks.md → AGENTS.md
- `LoginPage()` --calls--> `getSession()`  [EXTRACTED]
  app/login/page.tsx → lib/session.ts
- `graphify Skill` --references--> `AGENTS.md graphify integration section`  [EXTRACTED]
  .codex/skills/graphify/SKILL.md → AGENTS.md
- `/graphify query command` --references--> `AGENTS.md graphify integration section`  [EXTRACTED]
  .codex/skills/graphify/SKILL.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Amplify Frontend CI/CD Pipeline (preBuild -> build -> artifacts, cached)** — amplify_prebuild_phase, amplify_build_phase, amplify_artifacts_config, amplify_cache_config [EXTRACTED 1.00]

## Communities (25 total, 9 thin omitted)

### Community 0 - "graphify Skill & Tooling"
Cohesion: 0.09
Nodes (32): AGENTS.md graphify integration section, This is NOT the Next.js you know (AGENTS.md rules), CLAUDE.md (project root), add-watch.md reference, graphify.ingest.ingest function, graphify.watch module, graphify claude install/uninstall, hooks.md reference (commit hook + CLAUDE.md integration) (+24 more)

### Community 1 - "Project Dependencies"
Cohesion: 0.06
Nodes (30): sharp, unrs-resolver, dependencies, @aws-sdk/client-bedrock-agentcore, @aws-sdk/client-cognito-identity-provider, next, react, react-dom (+22 more)

### Community 2 - "graphify Export Formats"
Cohesion: 0.08
Nodes (24): graphify benchmark (token reduction), exports.md reference, graphify export falkordb, graphify export graphml, graphify.serve MCP stdio server, graphify export neo4j, graphify export svg, graphify export wiki (+16 more)

### Community 3 - "Main Chat Component"
Cohesion: 0.14
Nodes (11): ChatFormSubmitEvent, INITIAL_MESSAGES, MainChatProps, ChatApiClient, readErrorMessage(), RestChatApiClient, SendMessageOptions, SendMessageResult (+3 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 5 - "Chat API Route (Streaming)"
Cohesion: 0.18
Nodes (13): AgentInvocation, client, decodeSseFrame(), invokeAgentCore(), invokeLocalAgent(), isRecord(), parseChatRequest(), pipeEventStream() (+5 more)

### Community 6 - "Chat Shell & Layout Pages"
Cohesion: 0.15
Nodes (11): buildCognitoLogoutUrl(), Home(), ChatShell(), ChatShellProps, ChatSidebar(), ChatSidebarProps, SIDEBAR_ITEMS, SidebarInfoCardProps (+3 more)

### Community 7 - "graphify CLI Commands"
Cohesion: 0.16
Nodes (15): graphify clone command, github-and-merge.md reference, graphify extract CLI, graphify merge-graphs command, transcribe.md reference (video/audio), graphify.transcribe.transcribe_all function, GRAPHIFY_WHISPER_PROMPT domain hint, graphify full pipeline (+7 more)

### Community 8 - "Auth Routes & Cognito Client"
Cohesion: 0.32
Nodes (10): POST(), POST(), POST(), cognitoClient, computeSecretHash(), extractUserFromIdToken(), initiateAuth(), respondToNewPasswordChallenge() (+2 more)

### Community 9 - "Chat Bot Architecture Overview"
Cohesion: 0.21
Nodes (12): AgentCore simple_langchain_agent, API Gateway (NEXT_PUBLIC_API_BASE_URL), app/api/chat/route.ts (BFF proxy), Browser -> Next.js -> API Gateway -> Lambda -> AgentCore flow, Backend-for-frontend (BFF) proxy rationale, Chat Bot UI project (README.md), components/ (chatbot UI), CORS problem (browser to API Gateway) (+4 more)

### Community 10 - "Amplify Build Pipeline"
Cohesion: 0.36
Nodes (9): Build Artifacts Configuration (.next baseDirectory), build Phase, Build Cache Configuration (node_modules, .next/cache), Amplify Build Configuration (amplify.yml), corepack enable / prepare pnpm@latest, Bake COGNITO_/NEXTAUTH_/AGENT_RUNTIME_ARN/CHAT_ACTOR_ID env vars into .env.production, pnpm build, pnpm install --frozen-lockfile (+1 more)

### Community 11 - "Header/Sidebar Controls"
Cohesion: 0.40
Nodes (3): ChatHeaderControlsProps, SidebarControlIcon(), SidebarControlIconProps

### Community 12 - "Root Layout & Fonts"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 13 - "Backend Response Parsing"
Cohesion: 0.67
Nodes (3): BackendChatBody, isRecord(), parseBackendResponse()

## Ambiguous Edges - Review These
- `CLAUDE.md (project root)` → `Chat Bot UI project (README.md)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **88 isolated node(s):** `ChatHeaderControlsProps`, `SidebarControlIconProps`, `eslintConfig`, `BackendChatBody`, `config` (+83 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `CLAUDE.md (project root)` and `Chat Bot UI project (README.md)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `graphify Skill` connect `graphify Skill & Tooling` to `graphify CLI Commands`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `graphify full pipeline` connect `graphify CLI Commands` to `graphify Skill & Tooling`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `ChatHeaderControlsProps`, `SidebarControlIconProps`, `eslintConfig` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graphify Skill & Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.09475806451612903 - nodes in this community are weakly interconnected._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `graphify Export Formats` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._