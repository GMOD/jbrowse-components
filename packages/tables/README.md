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

Every engine in the process shares what the engine keeps between calls, under
three bounds that share no space:

- **Decoded records:** at most `limit`, 256 MiB unless set.
- **Chunks:** the file bytes read in ranges, under the chunk cache's own cap of
  1000 chunks of 256 KiB.
- **Adapters:** the ones the last call read, whatever they weigh, then the most
  recently read others while their weight fits another `limit`. An adapter
  weighs at least 1 MiB, and an estimate of what each file it read whole holds
  once parsed: a BAI four times its size, a CSI five, a CRAI 12, a TBI 20.
- `engine.cache({ limit })` sets `limit` in bytes, `Infinity` for none, and
  reports what the engine holds; `engine.clearCache()` empties it.
- A call's own reads and tables come on top, which one wide read of a deep BAM
  takes to gigabytes. So does the memory of the wasm decompressors, which
  `limit` cannot lower.
- A host that never yields to its event loop keeps alive every object a
  `WeakRef` points to, the shared budget's evicted caches among them, so await a
  macrotask between calls. From R's V8 the engine frees them.
