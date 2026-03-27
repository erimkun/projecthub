# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Warning

**This is NOT standard Next.js.** This project uses Next.js 16.2.1 and React 19.2.4, which have significant breaking changes from typical Next.js patterns. Always check `node_modules/next/dist/docs/` before writing any code and heed deprecation notices. See AGENTS.md for details.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

The dev server runs on http://localhost:3000.

## Project Overview

Project Hub is a team productivity dashboard with personal focus and team transparency features. It's a Turkish-language application ("Ekip Üretkenlik Paneli") that manages:

- Tasks assigned to team members with week-based organization
- Projects with color coding
- Member status tracking (available, busy, sos, helping)
- Notes with task linking
- Notifications system
- Week rollover (automatic and manual task carryover)

## Architecture

### Tech Stack

- **Framework**: Next.js 16.2.1 (App Router) with React 19.2.4
- **Language**: TypeScript 5
- **Database**: SQLite via better-sqlite3 (with WAL mode)
- **State Management**: Zustand
- **Auth**: JWT via jose (session cookie: `ph_session`)
- **Styling**: CSS custom properties in `globals.css` (CSS variables for theming)
- **Animation**: GSAP for motion-lab experiments

### Key Directories

```
app/
├── api/           # Next.js API routes
│   ├── auth/      # Login/register/logout endpoints
│   ├── members/   # Team member CRUD
│   ├── tasks/     # Task CRUD with filtering
│   ├── projects/  # Project management
│   ├── notes/     # Notes with task linking
│   ├── notifications/
│   ├── rollover/  # Week transition logic
│   └── import/    # Excel import functionality
├── login/         # Authentication page
├── motion-lab*/   # GSAP animation experiments
├── layout.tsx     # Root layout (Turkish locale)
└── page.tsx       # Redirects to motion-lab-1

components/        # React components
├── PersonalDashboard.tsx   # Main dashboard view
├── TeamRadar.tsx          # Team overview
├── TaskCard.tsx          # Task display
├── MemberCard.tsx        # Member display
├── NotesEditor.tsx       # Notes with task linking
├── Sidebar.tsx, Topbar.tsx
└── [modals]/             # AddMemberModal, AddProjectModal, etc.

lib/
├── store.ts       # Zustand store (client-side state)
├── db.ts          # SQLite database connection and schema
├── types.ts       # TypeScript type definitions
├── session.ts     # JWT session management
└── parser.ts      # Utility for parsing mentions/tags

data/              # SQLite database files (ignored in git)
public/            # Static assets
```

### Database Schema

SQLite database auto-initializes with:

- `users` - Authentication (bcryptjs hashed passwords)
- `members` - Team members with status
- `projects` - Color-coded projects
- `tasks` - Core entity with week/year tracking, rollover support
- `notes` - Rich text notes
- `note_tasks` - Many-to-many link between notes and tasks
- `notifications` - In-app notifications
- `app_settings` - Key-value settings

### State Management Pattern

Zustand store in `lib/store.ts` manages all client-side data:

- Fetches via standard `fetch()` to API routes
- All CRUD operations go through store actions
- Automatic member selection on first load
- Week/year selection for task filtering

### API Patterns

API routes use Next.js App Router pattern:

```typescript
// GET with query params
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('key');
  // ...
}

// POST/PATCH/DELETE with JSON body
export async function POST(req: NextRequest) {
  const body = await req.json();
  // ...
}
```

Database queries use `better-sqlite3` with parameter binding.

### Authentication Flow

1. User logs in at `/login`
2. Server validates credentials against `users` table
3. JWT token created via jose, stored in `ph_session` cookie
4. Routes check session via `getSession()` from `lib/session.ts`
5. Token expires in 7 days

### Task Rollover System

Tasks are organized by week/year. Rollover handles unfinished tasks:

- **Manual rollover**: Triggered by user, creates new tasks in next week
- **Auto rollover**: Runs automatically when viewing a new week
- Tasks marked `is_rollover=1` track lineage via `origin_task_id`
- Archive: Tasks >2 weeks old are considered archived

### Magic Input Syntax

The `MagicInput` component supports parsing:
- `@mention` - Reference team members
- `#tag` - Add tags
- `>project` - Reference projects

### Import/Export

Excel file support via `xlsx` library:
- Import tasks from Excel
- Export tasks to Excel

## Common Patterns

### Path Aliases

Use `@/` prefix for project imports:
```typescript
import { useAppStore } from '@/lib/store';
import getDb from '@/lib/db';
```

### CSS Variables

The app uses CSS custom properties defined in `globals.css`:
- `--bg-base`, `--bg-surface`, `--bg-elevated` - Backgrounds
- `--text-1`, `--text-2`, `--text-3` - Text hierarchy
- `--accent` - Primary brand color
- `--accent-sos` - Alert/status color
- `--border` - Border colors
- `--radius-*` - Border radius scale

### Component Conventions

- Client components use `'use client'` directive
- Components use inline styles with CSS variables
- Modal components controlled by parent state
- Icons from `lucide-react`

### Date Handling

Week numbers calculated via custom logic in `lib/parser.ts`:
```typescript
import { getWeekNumber } from '@/lib/parser';
const { week, year } = getWeekNumber();
```

### Form Handling

Forms use controlled inputs with React state:
- Client-side validation before submit
- Error states displayed inline
- Loading state on submit buttons
- Escape key to cancel (for quick-add inputs)

## Environment Variables

Optional (fallbacks provided):
- `JWT_SECRET` - Secret for JWT signing (default: 'project-hub-super-secret-key-change-in-production')

## Important Notes

- Database is local SQLite - data persists in `data/project-hub.db`
- Database runs in WAL mode (separate `.db-shm` and `.db-wal` files)
- `next.config.ts` marks `better-sqlite3` as external for server bundling
- Motion-lab pages are animation experiments using GSAP
- Default user: Register via `/login` to create first account
