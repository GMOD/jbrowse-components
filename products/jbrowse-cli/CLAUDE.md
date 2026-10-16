# jbrowse-cli

- **Every module in `src/` imports `fetch` from `./cliFetch.ts`**, so
  `jest.mock('../cliFetch')` intercepts it; global `fetch` hits the real API.
- `@jbrowse/text-indexing-core` uses global `fetch` on purpose (it also runs in
  the desktop indexing worker), and CLI tests' `@jest-environment node` docblock
  skips the fetch mock setup, so an inert `mockFetch` there hits the network.
  Use `mockGlobalFetch` from `testUtil.ts` for anything reached through it.
- **Synteny `--assemblyNames` is query,target**, the reverse of
  minimap2/nucmer's input order: `minimap2 ref.fa qry.fa` →
  `add-track -a qry,ref`. Don't "correct" it; the swapped track's refNames match
  neither assembly. MCScan adapters follow `bed1Location`/`bed2Location`
  instead.
