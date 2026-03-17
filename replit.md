# Workspace

## Overview

pnpm workspace monorepo using TypeScript. GlassCrawler — an OLX listing scraper web app with a Liquid Glass / Glassmorphism UI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **Routing**: Wouter

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── glass-crawler/      # GlassCrawler frontend (React + Vite)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## GlassCrawler App

### Features
- **Home screen** - Glassmorphism UI with vibrant gradient background, frosted glass input fields for Location, Product Name, and Negative Keywords
- **Crawl engine** - HTTP-based OLX scraper that handles pagination, runs asynchronously in the background
- **Progress tracking** - Real-time polling of crawl status with pages loaded / items found / items filtered stats
- **Results grid** - Scrollable grid of glass product cards
- **Detail modal** - Full listing info with "View on OLX" link
- **Duplicate prevention** - Unique OLX IDs prevent re-saving the same listing
- **Negative keyword filtering** - Any listing title/description matching excluded keywords is skipped

### API Endpoints
- `POST /api/crawl` - Start a crawl session
- `GET /api/crawl/:sessionId` - Poll session status
- `GET /api/sessions` - List all sessions
- `GET /api/listings` - Get all listings (filterable by search/sessionId)
- `GET /api/listings/:id` - Get single listing
- `DELETE /api/listings/:id` - Delete listing

### DB Schema
- `crawl_sessions` - Tracks crawl jobs (status, progress counters, params)
- `listings` - Stored OLX listings with olxId unique constraint for deduplication

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerates API client hooks and Zod schemas from openapi.yaml
- `pnpm --filter @workspace/db run push` — push DB schema changes
