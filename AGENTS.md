<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Guidelines

Use this file as the single workspace instruction source for this repo.

## Build And Validate

Run from `project-hub/`:

```bash
npm install
npm run dev
npm run build
npm run lint
```

Notes:
- There is currently no test script in `package.json`.
- Dev server default is `http://localhost:3000`.

## Architecture

- App framework: Next.js App Router + React + TypeScript.
- Backend style: Route Handlers in `app/api/**/route.ts` with SQLite (`better-sqlite3`) through `lib/db.ts`.
- Frontend state: Client-side Zustand store in `lib/store.ts`; components call store actions, and store actions call `/api/*` endpoints.
- Auth: JWT session cookie `ph_session` via `lib/session.ts` and `/api/auth/*`.

For deeper repository detail, see `CLAUDE.md` (link, do not duplicate).

## Conventions

- Prefer path alias imports: `@/lib/...`, `@/components/...`.
- Keep API handlers in App Router pattern (`GET/POST/PATCH/DELETE` exports) and return `NextResponse.json(...)`.
- Use parameterized SQL through prepared statements (`db.prepare(...).run/get/all(...)`), not string interpolation with user input.
- Preserve Turkish UI strings and labels by default; do not translate or rewrite language unless explicitly requested.
- Reuse shared domain types in `lib/types.ts` before adding ad-hoc local types.

## Pitfalls

- `lib/db.ts` initializes schema and runs migrations via `ensureColumn(...)`; avoid duplicate table/column initialization logic in route handlers.
- `data/project-hub.db` is local persistent state; changes may depend on existing data shape.
- Week-based behavior (rollover/filtering) depends on utilities in `lib/parser.ts` and rollover logic in `app/api/rollover/route.ts`; preserve those semantics when changing task flows.

## Key Files

- `lib/store.ts`: central client data flow and API orchestration.
- `lib/db.ts`: DB schema + connection lifecycle.
- `app/api/tasks/route.ts` and `app/api/tasks/[id]/route.ts`: primary task CRUD/query patterns.
- `app/api/auth/route.ts` and `lib/session.ts`: auth/session reference.
