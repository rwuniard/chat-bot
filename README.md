## Chat Bot UI

This project is a standalone Next.js frontend for a chatbot experience that will eventually connect to an agentic AI backend through a REST API.

The current implementation intentionally has:
- no authentication
- a mock API adapter instead of the real backend
- a typed client boundary so the backend can be integrated later with minimal UI churn

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create a local env file when you are ready to point the UI at a real backend.

```bash
cp .env.local.example .env.local
```

Current setting:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

## Current structure

- `app/`: app router entrypoints and global styles
- `components/`: client-side chatbot UI
- `lib/`: backend client boundary and adapters
- `types/`: shared UI and API contract types

## Backend integration plan

When the backend is available, replace the mock client in `lib/chat-api.ts` with a real REST implementation. The UI should continue to use the same client interface unless the API contract changes.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
