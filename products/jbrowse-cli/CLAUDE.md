# jbrowse-cli

Every module in `src/` must `import fetch from './cliFetch.ts'` so
`jest.mock('../cliFetch')` intercepts it; global `fetch` hits the real API.

The exception is code in other packages: `@jbrowse/text-indexing-core` uses
global `fetch` on purpose (it also runs in the desktop indexing worker), and CLI
tests' `@jest-environment node` docblock opts them out of the fetch mock setup —
so an inert `mockFetch` there silently hits the network. Use `mockGlobalFetch`
from `testUtil.ts` for anything reached through text-indexing-core.

## Synteny `--assemblyNames` is query,target

**Query first** — the reverse of the order minimap2/nucmer take their inputs. So
`minimap2 ref.fa qry.fa` → `add-track -a qry,ref`. Do not "correct" this to
`target,query`; that is the common point of confusion and produces a track whose
refNames won't match their assembly. MCScan adapters differ: their order follows
`bed1Location`/`bed2Location`.
