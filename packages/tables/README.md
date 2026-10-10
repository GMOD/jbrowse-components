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
