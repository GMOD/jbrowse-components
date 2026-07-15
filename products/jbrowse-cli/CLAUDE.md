# jbrowse-cli CLAUDE.md

## Always use cliFetch, not global fetch

All modules in `src/` must import and use `cliFetch` instead of the global
`fetch` function. This allows tests to mock API calls via Jest's
`jest.mock('../cliFetch')`. If a module uses global `fetch`, test mocks won't
intercept those calls and tests will hit the real API instead.

Example:

```typescript
import fetch from './cliFetch.ts' // ✓ Correct
// const response = await fetch(url)  // ✗ Wrong - uses global fetch
```

This applies to all files including utils, commands, types, and helpers.

## Synteny `--assemblyNames` order is query,target (reverse of aligner args)

For synteny tracks (`PAFAdapter`, `DeltaAdapter`, `ChainAdapter`),
`--assemblyNames`/`-a` is `query,target` — **query first**. This is the
**reverse** of the order minimap2/nucmer take their inputs (`target query`). So
`minimap2 ref.fa qry.fa` → `add-track -a qry,ref`.

Source of truth: `getAssemblyNamesFromConf` in
`plugins/comparative-adapters/src/util.ts` returns
`[queryAssembly, targetAssembly]`, and PAFAdapter maps `assemblyNames[0]` to the
PAF query columns (col 1-4) and `assemblyNames[1]` to the target columns (col
6-9). Verified by `PAFAdapter.test.ts` (assembly index 0 resolves to the query
refName). In the dotplot the query is the horizontal axis; in linear synteny it
is the top row.

Do not "correct" this to `target,query` — that is the common point of confusion
and produces a broken track (refNames won't match their assembly).

MCScan adapters are different: their order follows `bed1Location`/`bed2Location`
(bed1 → `assemblyNames[0]`), not query/target.
