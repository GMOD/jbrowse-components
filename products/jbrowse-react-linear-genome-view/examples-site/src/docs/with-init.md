The same call against a real assembly. `init` is the recommended way to embed: a
starting locstring and the trackIds to open on first paint. `init.loc` takes any
locstring, including space-separated multi-region ones
(`'chr1:100-200 chr1:500-600'`). It is the same shape JBrowse Web serializes
into its `?session=spec-…`
[URL query parameter](https://jbrowse.org/jb2/docs/urlparams/).

**`init` runs once**, when the view is created — think of an input's
`defaultValue`. Re-rendering with a different `loc` won't move a view the user
has panned; to drive it after mount, take a `ref` and call
[navigation actions](../navigate-to-location/#external-navigate).

Three assembly fields above start mattering past a toy genome:

- [`refNameAliases`](https://jbrowse.org/jb2/docs/config/refnamealiasadapter/)
  resolves `chr1`, `1` and `NC_000001.11` to the same contig. Point it at UCSC's
  `chromAlias` and differently-named tracks still line up.
- `chromSizes` gives the sequence adapter chromosome lengths directly, so the
  view lays out the genome without reading the `.2bit` first.
- `csi: true` selects a `.csi` index instead of Tabix `.tbi`, required past ~512
  Mb.

See [advanced init](../session-setup/#with-init-advanced) for per-track display
snapshots, and the [config guide](https://jbrowse.org/jb2/docs/config_guide/)
for the full track/assembly shape.
