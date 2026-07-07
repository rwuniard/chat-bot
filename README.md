## Chat Bot UI

This project is a Next.js chatbot UI that connects to an agentic AI backend through a REST API.

The current implementation intentionally has:
- no authentication
- a typed client boundary in `lib/chat-api.ts` so the UI stays stable as the backend evolves
- a Next.js API route proxy so the browser does not call AWS directly

## Architecture

End-to-end request flow:

```
Browser → Next.js (/api/chat) → API Gateway → Lambda → AgentCore (simple_langchain_agent)
```

1. **Browser** — the chat UI in `components/` sends messages to the same-origin Next.js API route (`/api/chat`).
2. **Next.js** — `app/api/chat/route.ts` forwards the request server-side to API Gateway. This avoids browser CORS issues when calling AWS from `localhost` or a separate frontend domain.
3. **API Gateway** — exposes the REST endpoint configured in `NEXT_PUBLIC_API_BASE_URL`.
4. **Lambda** — handles the HTTP request and invokes the agent.
5. **AgentCore (`simple_langchain_agent`)** — runs the LangChain agent and returns the assistant reply.

The API Gateway response is wrapped in a Lambda proxy shape (`statusCode`, `headers`, `body`). The route parses the stringified `body`, extracts `result` for the chat UI, and returns `session_id` as the conversation id.

### Why `app/api/chat/route.ts` exists

Calling API Gateway directly from the browser would require correct CORS headers on every HTTP response. In practice, the Lambda may include CORS metadata inside the JSON payload without API Gateway mapping those values onto the actual response headers.

The Next.js route acts as a **backend-for-frontend (BFF) proxy**:

- **Browser → Next.js**: same origin, so CORS does not apply.
- **Next.js → API Gateway**: server-to-server `fetch`, so CORS does not apply.

Later, when this app runs on EKS and talks to AgentCore via the AWS SDK (for example boto3), that path is also server-to-server and CORS remains irrelevant for the agent call. CORS would only matter at the edge if the browser and Next.js API are served from different origins.

## Local development

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production-style run:

```bash
pnpm build
pnpm start
```

## Environment

Copy the example env file and set your API Gateway endpoint:

```bash
cp .env.local.example .env.local
```

Required setting:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com/prod/simple_langchain_agent
```

Restart the dev server after changing environment variables.

## Scripts

- `scripts/dynamodb_table_create.sh`: creates the two DynamoDB tables used for chat persistence (`ChatConversations`, `ChatMessages`). Safe to re-run — skips a table if it already exists. See `docs/superpowers/specs/2026-07-06-chat-persistence-design.md` for the schema and rationale.

  ```bash
  ./scripts/dynamodb_table_create.sh
  ```

  Requires AWS credentials configured for the CLI; defaults to the `us-east-1` region (override with `AWS_REGION`).

## IAM permissions (Amplify compute role)

Creating the tables isn't enough on its own — the app's Amplify compute role needs a policy granting it access to these two tables, or every DynamoDB call from `/api/chat` will fail with an access-denied error at runtime. That same role also needs `bedrock-agentcore:InvokeAgentRuntime` for the AgentCore calls the chat route already makes.

Full policy for that role (both statements together — replace `<ACCOUNT_ID>` and `<RUNTIME_ID>` with your own values, matching `AGENT_RUNTIME_ARN` in your environment):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeAgentCoreRuntime",
      "Effect": "Allow",
      "Action": "bedrock-agentcore:InvokeAgentRuntime",
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:<ACCOUNT_ID>:runtime/<RUNTIME_ID>*"
    },
    {
      "Sid": "AllowChatHistoryTableOperations",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/ChatConversations",
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/ChatMessages"
      ]
    }
  ]
}
```

Note there's no separate `dynamodb:TransactWriteItems` action to grant — AWS authorizes each operation inside a transaction (`Put`, `Update`) against these same item-level permissions, so this list already covers it.

## Current structure

- `app/`: App Router entrypoints, global styles, and API routes
- `app/api/chat/route.ts`: server-side proxy to API Gateway
- `components/`: client-side chatbot UI
- `lib/chat-api.ts`: browser client that calls `/api/chat`
- `types/`: shared UI and API contract types

## Request and response contract

The proxy sends this JSON body to API Gateway:

```json
{
  "message": "who am I?",
  "session_id": "0a7233bc-bc2c-479a-92a8-6436c984a6fd",
  "actor_id": "<cognito-sub-of-the-logged-in-user>"
}
```

`session_id` maps to the frontend conversation id. `actor_id` is the authenticated user's Cognito `sub` (from the session cookie), so the agent's own memory is scoped per user rather than shared across everyone using the app.

The route expects an API Gateway-style response and reads the assistant text from the parsed `body.result` field.
