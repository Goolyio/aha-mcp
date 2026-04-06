# Checkpoint 01: Foundation

## What's done
- `README.md` — project overview, setup, tool reference, Claude Desktop config
- `docs/graphql-schema.md` — summary of known Aha! GraphQL types, queries, mutations
- `package.json` / `tsconfig.json` — Bun/ESM setup, `bin` field for `bunx` support
- `src/models/` — 6 TypeScript interface files: `common`, `user`, `workflow`, `project`, `iteration`, `feature`
- `src/queries.ts` — all GraphQL query/mutation strings + response types + `ITERATION_STATUS` constants
- `src/client.ts` — `graphql<T>()`, `restGet<T>()`, `getCurrentUser()` (REST /api/v1/me, cached), `resolveFeatureId()` (refNum → opaque ID lookup)

## Deviations from plan
- None so far.

## Next
- `src/tools/read.ts` — 7 read-only tools
- `src/tools/write.ts` — 3 mutation tools
- `src/index.ts` — server entry point
