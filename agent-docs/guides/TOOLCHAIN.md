# Toolchain: TypeScript 6 vs 7 split

We run two TypeScript versions on purpose. Don't "fix" this by unifying them.

## Why two versions

- **The eslint backstop needs 6.x.** `pnpm lint` is now oxlint (type-aware via
  tsgolint, which uses its own TS7-based checker — it does NOT read the ambient
  `typescript`). But the CI backstop `pnpm lint:eslint` still parses with
  `@typescript-eslint`, whose `ts-api-utils` peer range is `<6.1.0`; bumping the
  ambient `typescript` breaks it. (The backstop is type-info-free, so it doesn't
  type-check with 6.x — it just needs the parser to install.)
- **Typecheck wants 7.x for speed.** `pnpm typecheck` runs an aliased
  `typescript7` devDependency (`npm:typescript@7`) by path
  (`node node_modules/typescript7/bin/tsc --noEmit`).
- **`build:esm` uses 6.x.** `tsc --build` in individual package scripts runs on
  the ambient 6.x.

## The rule

Keep `typescript` on 6.x; keep `typescript7` as the aliased 7.x. Once
typescript-eslint ships TS7 support, drop the alias and bump `typescript`
itself to 7.
