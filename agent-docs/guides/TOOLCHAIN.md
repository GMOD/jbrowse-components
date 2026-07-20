# Toolchain: TypeScript 6 vs 7 split

We run two TypeScript versions on purpose. Don't "fix" this by unifying them.

## Why two versions

- **Lint needs 6.x.** `@typescript-eslint` / `ts-api-utils` peer range is
  `<6.1.0` — they haven't shipped TypeScript 7 support. Bumping the ambient
  `typescript` devDependency breaks `pnpm lint`.
- **Typecheck wants 7.x for speed.** `pnpm typecheck` runs an aliased
  `typescript7` devDependency (`npm:typescript@7`) by path
  (`node node_modules/typescript7/bin/tsc --noEmit`).
- **`build:esm` uses 6.x.** `tsc --build` in individual package scripts runs on
  the ambient 6.x.

## The rule

Keep `typescript` on 6.x; keep `typescript7` as the aliased 7.x. Once
typescript-eslint ships TS7 support, drop the alias and bump `typescript`
itself to 7.
