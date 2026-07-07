# Chat Persistence (DynamoDB) — Design

## Goal

Persist chat conversations per user so they survive page reloads, and give the
left-hand sidebar a real list of past conversations to reopen — similar to the
Claude desktop app's conversation list.

## Non-goals (out of scope for v1)

- Renaming conversations (deleting is supported — see "Deleting a
  conversation" below)
- Pagination past the fixed caps described below (no "load more" for either
  the sidebar list or a conversation's messages)
- Full-text search across history
- Auto-expiry / TTL of old conversations
- Multi-device real-time sync
- Changing what the *agent* remembers — Bedrock AgentCore continues to own
  actual conversation continuity via `session_id`. DynamoDB is a UI-facing
  transcript store only; it is never read back and sent to the agent.

## Data model

Two DynamoDB tables, on-demand billing (no capacity planning needed at this
scale).

### `ChatConversations` — one item per conversation

| Attribute | Type | Notes |
|---|---|---|
| `userId` (PK) | string | Cognito sub, from the session cookie |
| `sessionId` (SK) | string | Same id used as the AgentCore `session_id` / `conversationId` |
| `title` | string | First user message, truncated |
| `createdAt` | string (ISO) | |
| `updatedAt` | string (ISO) | Bumped on every subsequent message |

Access patterns:
- `Query(PK=userId)` → sidebar list, sorted by `updatedAt` desc in the API, capped to the most recent 30.
- Conditional writes against this table's key (`PK=userId, SK=sessionId`) double as the ownership check — see "Ownership checks" below.

### `ChatMessages` — one item per message

| Attribute | Type | Notes |
|---|---|---|
| `sessionId` (PK) | string | |
| `createdAt#messageId` (SK) | string | `createdAt` ISO string + the client-generated message id; unique and naturally sorts chronologically |
| `userId` | string | Denormalized, non-key. Audit only — never used to build a query key. |
| `role` | string | `user` \| `assistant` \| `system` |
| `content` | string | |
| `status` | string (optional) | |

Access pattern: `Query(PK=sessionId, ScanIndexForward=false, Limit=50)` → last
50 messages, reversed to chronological order for display.

`userId` doesn't need to be part of any key here: messages are only ever
queried scoped to one `sessionId`, and the user↔session ownership check
already happened one table over.

## Ownership checks

Every operation that touches an existing `sessionId` must first prove that
`sessionId` belongs to the caller's `userId`, because `sessionId` is just a
UUID with no other access control:

- **Loading a conversation's messages** (`GET /api/conversations/:sessionId/messages`): `GetItem(userId, sessionId)` against `ChatConversations` before ever querying `ChatMessages`. Not found → 404.
- **Continuing a conversation** (`POST /api/chat` with a `conversationId`): the write itself is conditional — `Update` on `ChatConversations` with `ConditionExpression: attribute_exists(sessionId)`, scoped under the caller's own `PK=userId`. If the id doesn't exist under this user (stale client state, tampering, a race), the condition fails.

On any ownership mismatch, the request is rejected with an error (404 /
"conversation not found") and the UI surfaces that to the user. There is no
silent fallback (e.g. silently minting a new conversation) — an unexpected
mismatch should be visible, not papered over.

**Scaling note:** both of these are exact-key operations (full partition key
+ sort key specified), not scans or index lookups — DynamoDB routes them
directly to the one partition holding that item via hashing. Their cost and
latency are independent of total table size; a table with a billion
conversations across every user checks ownership exactly as fast as one with
a hundred. With on-demand billing, cost scales with request volume (how many
chat turns/conversation-opens happen), not with how much history has
accumulated. The one read that *does* scale with data rather than a fixed
key lookup is the sidebar's `Query(PK=userId)` — its cost is bounded by one
user's own conversation count (not the whole table), and is further capped
by only displaying the most recent 30.

## Avoiding empty/ghost conversations

A conversation record must never exist without at least one message backing
it. Two things guarantee this:

1. **Clicking "New chat" is purely client-side** — it resets local state
   (`conversationId = undefined`, messages reset) and makes no network call.
   Nothing is persisted until the user actually sends a message.
2. **Creating a conversation and writing its first message are one atomic
   operation.** `POST /api/chat` uses a single `TransactWriteItems` call:
   - `Put` on `ChatConversations` (`ConditionExpression: attribute_not_exists(sessionId)`, guards against an near-impossible UUID collision)
   - `Put` on `ChatMessages` for the user's message

   Both succeed or both fail — a transient DynamoDB error can't leave a
   title-only conversation with zero messages in it.

   Continuing an existing conversation uses the same
   transactional-write shape, just with an `Update` (bump `updatedAt`,
   conditioned on existence as described above) in place of the conditional
   `Put`.

If the agent invocation itself fails *after* this transaction has already
committed (e.g. Bedrock AgentCore is unreachable), the conversation and the
user's message remain persisted — that's correct: the message really was
sent, the agent just failed to reply. The assistant's message is only ever
written after a successful stream completes; a failed turn writes no
assistant message, matching how the UI already drops a failed reply bubble
from the transcript entirely.

## Deleting a conversation

`DELETE /api/conversations/:sessionId` reverses the "avoiding ghost
conversations" invariant from the other direction: it's fine to briefly have
messages with no owning conversation row (harmless orphans, unreachable by
any read path), but never fine to have a conversation row that still shows
in the sidebar with no way to load it.

- The `ChatConversations` row is deleted first, conditioned on
  `attribute_exists(sessionId)` — the same ownership-check shape used
  elsewhere, scoped under the caller's own `PK=userId`. A missing/foreign
  `sessionId` fails this condition and the request is rejected (404), never
  silently no-op-succeeding on someone else's conversation.
- Only after that succeeds does cleanup of the conversation's `ChatMessages`
  items happen — paginated (`ExclusiveStartKey`/`LastEvaluatedKey`, since a
  long conversation's message count is unbounded) and batch-deleted in
  chunks of 25 (`BatchWriteItem`'s per-call limit). This cleanup is
  best-effort: once the conversation row is confirmed gone, a failure here is
  logged and swallowed rather than surfaced, so the client always sees the
  delete as successful once the primary (conversation row) delete commits.
- A conversation actively receiving a streamed reply at the moment it's
  deleted is a known, accepted edge case: the in-flight turn's assistant
  message still gets written after the conversation row is gone, producing
  the same kind of harmless orphaned rows a cleanup failure would.

## API design

### `POST /api/chat` (modify existing route)

Before invoking the agent:
- New conversation (`conversationId` omitted): `sessionId = crypto.randomUUID()`, `TransactWriteItems` creates the `ChatConversations` row (`title` = truncated message) and the first `ChatMessages` item together.
- Continuing conversation: conditional `TransactWriteItems` bumps `updatedAt` and writes the new user message; condition failure → reject with "conversation not found."

The route already pipes the agent's streamed reply straight through to the
client without buffering. To persist the assistant's reply, the handler also
accumulates the full text server-side while it pipes each chunk (a small
addition — the streaming behavior itself doesn't change). Once the stream
completes successfully, that accumulated text is written as one
`ChatMessages` item (`role: assistant`, `status: complete`).

DynamoDB write failures anywhere in this route are logged and swallowed —
persistence is best-effort relative to the live chat experience and never
blocks or fails the response the user is waiting on. Message `content` is
never included in server logs.

### `GET /api/conversations` (new)

Auth via `getSession()` (401 if none). `Query` `ChatConversations` by
`userId`, sort desc by `updatedAt`, cap to 30. Returns
`[{ sessionId, title, createdAt, updatedAt }]`.

### `GET /api/conversations/:sessionId/messages` (new)

Auth via `getSession()`. Ownership check via `GetItem` (404 if missing/not
owned). `Query` `ChatMessages` for the last 50, reversed to chronological
order. Returns `{ messages: ChatMessage[] }`.

## Client changes

### `lib/chat-api.ts`

`SendMessageOptions` gains `onConversationId?: (conversationId: string) => void`.
`fetch()`'s promise resolves as soon as response headers arrive — well before
the body finishes streaming — so `RestChatApiClient.sendMessage` reads the
`X-Conversation-Id` header and invokes `onConversationId` immediately, instead
of waiting for the whole reply to be read. The existing `onChunk` streaming
loop and final `{ conversationId }` return value are unchanged.

### `components/main-chat.tsx`

`handleSubmit` passes `onConversationId` alongside `onChunk`. As soon as it
fires (i.e. as soon as send starts getting a response, not once the reply
finishes), `MainChat` calls `setConversationId(...)` and `onSessionChange({conversationId, sessionTitle: nextSessionTitle})` immediately — replacing
today's two-call pattern (an optimistic pre-send call with the old id, then a
second call after the full stream completes) with one call, fired early.

### `components/chat-shell.tsx`

Becomes the owner of the conversation list, not just the active
`conversationId`/`sessionTitle`:
- Fetches `GET /api/conversations` once on mount to seed the sidebar list.
- Its `onSessionChange` handler (passed to `MainChat`) upserts into that list: if the `sessionId` isn't already present, prepend a new entry built entirely from already-known client-side values (`sessionId` from the callback, `title` from `nextSessionTitle`, timestamps from `Date.now()`) — no extra round-trip. If it is present (continuing conversation), bump its `updatedAt` and move it to the front. Because this happens as soon as send starts, no separate "conversation not in list yet" race exists between sending and reopening.
- Passes `conversations`, the selected id, a `onSelectConversation`, and an
  `onNewChat` down to `ChatSidebar`.
- Selecting a conversation triggers `GET /api/conversations/:id/messages`,
  then renders `<MainChat key={conversationId} conversationId={conversationId} initialMessages={...} .../>` —
  changing `key` forces a clean remount per conversation, resetting
  draft/scroll/etc. for free instead of hand-rolled reset logic. `MainChat`
  needs both new props: `initialMessages` to seed the transcript, and
  `conversationId` so its internal state (currently always initialized to
  `undefined`) knows which conversation subsequent sends should continue,
  not just for brand-new conversations.

### `components/chat-sidebar.tsx`

Replaces the static single `SIDEBAR_ITEMS` nav entry with the fetched
conversation list (title + relative timestamp), a highlighted "currently
open" state, a "New chat" action, and an empty-state message when the user
has no conversations yet.

## Infra prerequisites (outside this repo's code)

- Provision both DynamoDB tables.
- Grant the Amplify compute role `dynamodb:GetItem`, `PutItem`, `Query`, and
  `UpdateItem` on both tables. There is no separate IAM action for
  `TransactWriteItems` itself — DynamoDB authorizes each operation inside a
  transaction (`Put`, `Update`) against the same item-level permissions used
  outside one, so granting `PutItem`/`UpdateItem` already covers the
  transactional writes this app makes.
- New env vars, following the existing `AGENT_RUNTIME_ARN`-style pattern:
  `CHAT_CONVERSATIONS_TABLE`, `CHAT_MESSAGES_TABLE`.
- New dependencies: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
  (`DynamoDBDocumentClient`, avoids manual attribute-value marshalling).

## Sequence diagrams

### 1. Login → fetch conversation list

```
Browser          Cognito              /api/auth/*         /api/conversations      ChatConversations
  |-- login ------->|                      |                     |                       |
  |<- redirect+code -|                     |                     |                       |
  |-- code -------------------------->|                          |                       |
  |                  |     verify code, set session cookie ----->|                       |
  |<---------- Set-Cookie: chat-session ----|                    |                       |
  |                                                                |                       |
  |-- GET /api/conversations ------------------------------------>|                       |
  |                                                                |-- getSession() (verify cookie)
  |                                                                |-- Query(PK=userId) ->|
  |                                                                |<- conversation items -|
  |                                                                |-- sort desc(updatedAt), cap 30
  |<---------------- [{sessionId,title,updatedAt}, ...] -----------|                       |
  ChatSidebar renders the list
```

### 2. Click a conversation in the sidebar → load its messages

```
Sidebar        ChatShell        /api/conversations/:id/messages     ChatConversations    ChatMessages
  |-- click -->|                            |                              |                 |
  |            |-- GET .../{sessionId}/messages ------------------------->|                 |
  |            |                            |-- getSession() ------------>|                 |
  |            |                            |-- GetItem(userId, sessionId) [ownership check] |
  |            |                            |<-- found -------------------|                 |
  |            |                            |   (not found -> 404, stop here)                |
  |            |                            |-- Query(PK=sessionId, ScanIndexForward=false,  |
  |            |                            |   Limit=50) ----------------------------------->|
  |            |                            |<-- last 50 items (desc) ------------------------|
  |            |                            |-- reverse -> chronological order               |
  |            |<---- { messages: [...] } --|                              |                 |
  |            |-- render <MainChat key={sessionId} initialMessages=... /> |                 |
```

### 3. "New chat" → send → response → persist

```
Sidebar    ChatShell/MainChat        /api/chat            ChatConversations   ChatMessages   AgentCore
  |--new chat-->| reset: conversationId=undefined, remount w/ INITIAL_MESSAGES
  |             |                        |                       |                |              |
  (user types + submits)                |                       |                |              |
  |             |-- POST {conversationId: undefined, message} -->|                |              |
  |             |                        |-- getSession() ------>|                |              |
  |             |                        |-- sessionId = randomUUID() (new)       |              |
  |             |                        |-- TransactWriteItems([                 |              |
  |             |                        |     Put(ChatConversations: userId, sessionId,         |
  |             |                        |         title=truncated(msg), createdAt=updatedAt=now,|
  |             |                        |         condition: attribute_not_exists(sessionId)),  |
  |             |                        |     Put(ChatMessages: sessionId, createdAt#msgId,     |
  |             |                        |         role=user, content=message),                  |
  |             |                        |   ]) ------------------------------------------------>|
  |             |                        |-- InvokeAgentRuntimeCommand(message, sessionId) --------------->|
  |             |                        |<-- response headers (incl. X-Conversation-Id) ---------|
  |             |<== fetch() resolves (headers only, body still streaming) ====|                |              |
  |             |-- onConversationId(sessionId) fires immediately              |                |              |
  |             |-- ChatShell: setConversationId, prepend sidebar entry        |                |              |
  |             |   {sessionId, title, createdAt: now, updatedAt: now} (no extra network call)   |              |
  |  Sidebar already shows the new chat while the reply is still streaming in  |                |              |
  |             |                        |<== SSE stream continues ================================|
  |             |<== chunk ==============|== pipe to browser + accumulate fullText server-side ===|
  |  (renders incrementally: "waiting..." -> streamed text)                                        |
  |             |                        |<-- stream done ------------------------------------------------|
  |             |                        |-- PutItem(sessionId, createdAt#msgId, role=assistant,
  |             |                        |   content=fullText) -------------------------------->|
  |             |                        |   (best-effort: failure logged, never surfaced to user)|
```

### 4. Existing conversation → send → response → persist

```
MainChat (conversationId=X)      /api/chat         ChatConversations   ChatMessages   AgentCore
  |-- POST {conversationId: X, message} -->|                |                |              |
  |                                         |-- getSession() -->|             |              |
  |                                         |-- sessionId = X (reuse)         |              |
  |                                         |-- TransactWriteItems([          |              |
  |                                         |     Update(ChatConversations: userId, X, updatedAt=now,
  |                                         |            condition: attribute_exists(sessionId)),
  |                                         |     Put(ChatMessages: X, createdAt#msgId, role=user,
  |                                         |         content=message),
  |                                         |   ]) --------------------------->|
  |                                         |   (condition fails -> reject: "conversation not found")|
  |                                         |-- InvokeAgentRuntimeCommand(message, X) ---------------->|
  |                                         |<-- response headers (X-Conversation-Id: X) -------------|
  |<== onConversationId(X) -- bump sidebar entry's updatedAt, move to front ==|                |              |
  |                                         |<== SSE stream (AgentCore recalls prior turns itself) ====|
  |<== chunk ===============================|== pipe + accumulate fullText ==========================|
  |                                         |-- PutItem(X, createdAt#msgId, role=assistant,
  |                                         |   content=fullText) -------------------------->|
```

## Test scenarios

The four flows above double as the core test scenarios for this feature:

1. Login → sidebar shows the user's existing conversations (and only theirs).
2. Selecting a sidebar conversation loads exactly that conversation's messages (and a tampered/foreign `sessionId` in the URL/request returns a "not found" error, never another user's data).
3. New chat → send → sidebar shows the new conversation as soon as the request starts (not after the full reply) → reload the page → the same conversation and its messages are still there.
4. Continuing an existing conversation → new messages append, `updatedAt` bumps the conversation to the top of the sidebar → a tampered/invalid `conversationId` is rejected with a visible error, not silently handled.

Plus the edge cases surfaced while designing:
- Clicking "New chat" without ever sending a message persists nothing.
- An agent invocation failure after the transactional write still leaves the conversation and the user's message persisted (correct — the message really was sent), but no assistant message is written.
