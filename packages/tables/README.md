# @jbrowse/tables

JBrowse's track data as columnar tables, for a host that draws them itself. A
table is what a display fetches and lays out: the alignments display's reads on
their pileup rows, with their mismatches, gaps and coverage. Each comes back as
columns, one array per field, which a host reads as a data frame.

```ts
import { createTablesEngine } from '@jbrowse/tables'

const engine = createTablesEngine()
const { reads, mismatches, gaps, coverage } = await engine.alignments({
  adapterConfig: { type: 'BamAdapter', bamLocation: { uri: 'reads.bam' } },
  region: { refName: 'chr1', start: 1_000_000, end: 1_010_000 },
})
```

`dist/jbrowse-tables.js` (`pnpm build:bundle`) is the same engine for a bare
ECMAScript host, such as R's V8: one file with no imports, which installs the
web globals the readers need and reads every byte through the host's
`jbrowseHost.readRange(url, start, end)`.
[ggjbrowse](https://github.com/GMOD/ggjbrowse) is the R package built on it.

Between calls the engine keeps up to 256 MiB, which every engine in the process
shares:

- **Decoded records**, three quarters.
- **File bytes**, one quarter: first the indexes of the adapters it keeps, each
  weighed by the files it read whole and at least 1 MiB, then the chunks it read
  in ranges, the least recently read file's dropped first. The adapters the last
  call read stay whatever they weigh.
- `engine.cache({ limit })` sets the budget in bytes, `Infinity` for none, and
  reports what the engine holds; `engine.clearCache()` empties it.
- The budget counts the caches the engine keeps between calls. While a call
  runs, the engine also holds that call's reads and tables, which one wide read
  of a deep BAM takes to gigabytes.
- A host that never yields to its event loop keeps alive every object a
  `WeakRef` points to, the shared budget's evicted caches among them, so await a
  macrotask between calls. From R's V8 the engine frees them.
