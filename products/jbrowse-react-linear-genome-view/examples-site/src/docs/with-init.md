The recommended way to embed JBrowse is the declarative `<LinearGenomeView>`
component's `init` prop. Give it a starting locstring and the trackIds you want
open on first paint — JBrowse fills in the rest, no separate view-state setup
needed.

`init.loc` accepts any locstring, including space-separated multi-region strings
(e.g. `'chr1:100-200 chr1:500-600'`). `init.tracks` is a plain list of trackIds
to open. This is the same `init` shape JBrowse Web serializes into its
`?session=spec-…` [URL query parameter](https://jbrowse.org/jb2/docs/urlparams/)
— the embedded component makes no assumptions about URLs, so you pass it
directly.

Adapters also accept a plain `uri` shorthand — JBrowse derives the standard
index file (e.g. [`.bam.bai`](https://jbrowse.org/jb2/docs/config/bamadapter/),
[`.gff3.gz.tbi`](https://jbrowse.org/jb2/docs/config/gff3tabixadapter/)) from it
automatically, so you rarely need to spell out the nested `bamLocation`/`index`
form. The full assembly/track config shape is covered in the
[config guide](https://jbrowse.org/jb2/docs/config_guide/).

See [Advanced init](../session-setup/#with-init-advanced) for per-track display
snapshots and view-level settings (cytobands, gridlines, colorByCDS, …), and
[Default session](../default-session/#default-session) for the full imperative
snapshot form.
