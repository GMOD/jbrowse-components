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

Every engine in the process shares what the engine keeps between calls, in three
pools that share no space, each under `limit` (256 MiB unless set):

- **Decoded records:** the BAM and CRAM records and tabix lines it decoded.
- **Chunks:** the file bytes read in ranges, in chunks of 256 KiB. A call whose
  reads exceed `limit` can read a chunk again inside itself, and `Infinity`
  leaves the chunks unbounded.
- **Adapters:** the ones the last call read stay whatever they weigh. Then each
  other adapter, most recently read first, stays if its weight still fits under
  `limit` beside those kept.
- An adapter weighs at least 1 MiB, or an estimate of what it parsed from the
  files it read whole, which is four times an index's uncompressed size and ten
  times any other file's, such as a plain or gzipped VCF.
- `engine.cache({ limit })` sets `limit` in bytes, `Infinity` for none, and
  reports what the engine holds: `chunks` is what the chunk cache holds, and
  `parsed` is the adapters' estimated weight. `engine.clearCache()` empties
  every cache.
- A call's own reads and tables come on top, which one wide read of a deep BAM
  takes to gigabytes. So does the BGZF inflater's wasm memory, which stays near
  20 MiB.
- R's V8 stops at a heap of about 1.4 GB, which whole-file adapters reach first,
  since a 24 MB plain VCF parses to about 220 MiB.
- A host that never yields to its event loop keeps alive every object a
  `WeakRef` points to, the shared budget's evicted caches among them, so await a
  macrotask between calls. The engine frees them itself in R's V8.
