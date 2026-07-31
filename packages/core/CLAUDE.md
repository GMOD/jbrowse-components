# packages/core

Don't hand-edit the `exports`/`publishConfig` maps in `package.json` — run
`pnpm generate:exports` (scans actual `@jbrowse/core/*` imports) after
adding/removing an importable module. `pnpm autogen` at the repo root runs it
too, and CI gates it with `pnpm autogen --check`.
