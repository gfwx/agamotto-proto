# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agamotto is a minimalist time tracking application built with React, TypeScript, and Vite. The app focuses on session-based time tracking with analytics, built as a Progressive Web App (PWA) using IndexedDB for local data persistence.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Data Layer - IndexedDB

The app uses IndexedDB for all data persistence with a structured database design:

- **Database**: `agamotto_db` (version 2)
- **Object Stores**:
  - `sessions`: Stores time tracking sessions with indexes on state and timestamp
  - `config`: Stores app configuration (stopgap settings, pause timestamps, etc.)
  - `tags`: Stores session tags with indexes on color, dateLastUsed, and totalInstances

#### Session States

Sessions progress through a defined state machine:
- `not_started`: Initial state for new session
- `active`: Timer is running
- `paused`: Timer is paused (only one active/paused session allowed at a time)
- `completed`: Session finished and saved with metadata
- `aborted`: Session discarded

**Critical constraint**: Only ONE session can be in `active` or `paused` state at any time. This is enforced in `appSessionUtil.ts:saveSession()`.

#### Tags System

Sessions can optionally be tagged for categorization. Tags have:
- **Unique name**: Primary key for the tag
- **Unique color**: Each tag must have a distinct color from a predefined palette of 24 colors
- **Usage tracking**: `dateLastUsed` and `totalInstances` (only incremented on completed sessions)
- **Default tags**: "routine", "sleep", "work" are initialized on first database setup

Tag lifecycle:
- Tags can be assigned/changed during `active` or `paused` states
- When a session is **completed**: Tag's `totalInstances` is incremented
- When a session is **aborted**: Tag's `totalInstances` is NOT incremented (but `dateLastUsed` is updated)
- Maximum 24 tags due to unique color constraint

#### Timer State Management

Timer state is managed through a combination of React state and IndexedDB config:
- `pauseTime`: Total accumulated pause duration for current session
- `lastPausedTimestamp`: Timestamp when timer was last paused
- Current elapsed time is calculated as: `Date.now() - (session.timestamp + pauseTime)`

### Component Structure

```
src/
├── app/
│   ├── App.tsx                 # Main app component with view routing
│   └── components/
│       ├── Stopwatch.tsx       # Timer UI and controls
│       ├── SessionDialog.tsx   # Modal for saving/discarding sessions
│       ├── DailySummary.tsx    # Today's analytics view
│       ├── HistoricalData.tsx  # Historical session analytics
│       └── ui/                 # shadcn/ui components
│           ├── tag.tsx         # Tag display component
│           └── tag-selector.tsx # Tag selection with fuzzy search
├── lib/
│   ├── db/
│   │   ├── db.ts              # IndexedDB initialization
│   │   ├── appSessionUtil.ts  # Session CRUD operations
│   │   ├── appConfigUtil.ts   # Config CRUD operations
│   │   ├── appMigrationUtil.ts # LocalStorage → IndexedDB migration
│   │   └── appTagUtil.ts      # Tag CRUD operations & color palette
│   ├── constants.ts           # Database and app constants
│   ├── csvExportUtil.ts       # CSV export functionality
│   └── debug.ts               # Debug API (window.agamotto)
└── styles/
    └── index.css              # Global styles with Tailwind
```

### State Management

The app uses React's built-in state management:
- **App.tsx**: Top-level state for sessions, current session, view routing, and timer state
- **Component Props**: Timer state (`time`, `isRunning`, `isPaused`) passed to Stopwatch
- **IndexedDB**: Persistent state synchronized with React state

### Timer Implementation

Timer updates happen in two places:
1. **Display updates**: `useEffect` with 100ms interval updates the time display when running
2. **Persistence**: Session state changes (start/pause/resume/complete) immediately write to IndexedDB

The timer survives page refreshes by:
1. Loading active/paused session from IndexedDB on mount
2. Recalculating elapsed time based on session.timestamp and pauseTime
3. Page Visibility API handles app backgrounding/foregrounding

### Path Aliases

The project uses `@/` as an alias for the `src/` directory, configured in both `vite.config.ts` and `tsconfig.ts`.

## Key Libraries

- **UI**: Radix UI primitives with shadcn/ui components, Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner toast library
- **Charts**: Recharts (for analytics views)
- **PWA**: vite-plugin-pwa with auto-update registration

## Important Patterns

### Session Lifecycle

1. App initializes → Check for active/paused session in IndexedDB
2. If none exists → Create `not_started` session
3. User starts timer → Transition to `active` state, record timestamp
4. User pauses → Transition to `paused` state, track pause duration
5. User stops → Show SessionDialog to save or discard
6. Save → Transition to `completed`, create new `not_started` session
7. Discard → Transition to `aborted`, create new `not_started` session

### Data Migration

The app includes migration logic from localStorage to IndexedDB (`appMigrationUtil.ts`). Migration runs once on first database initialization if old localStorage keys are detected.

## TypeScript Configuration

The project uses strict TypeScript with:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

## Debugging

The app exposes a debug API on `window.agamotto` (see `lib/debug.ts`) for inspecting database state in development.
