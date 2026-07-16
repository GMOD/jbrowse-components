# TypeScript toolchain

**Don't bump the ambient `typescript` devDependency past 6.x — it breaks `pnpm lint`.**

`@typescript-eslint` / `ts-api-utils` haven't shipped TypeScript 7 support (peer
range `<6.1.0`), so the ambient `typescript` stays on 6.x. `tsc --build` in each
package's `build:esm` script runs on that ambient 6.x.

`pnpm typecheck` gets TS7's speed via a separate aliased `typescript7`
devDependency (`npm:typescript@7`), invoked by path in the root `typecheck`
script.

Once typescript-eslint ships TS7 support, drop the alias and bump `typescript`
itself to 7.
