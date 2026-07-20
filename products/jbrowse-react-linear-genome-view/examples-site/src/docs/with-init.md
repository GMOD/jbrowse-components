The declarative `init` prop is the recommended way to embed JBrowse. Give it a
starting locstring and the trackIds to open on first paint.

`init.loc` accepts any locstring, including space-separated multi-region strings
(`'chr1:100-200 chr1:500-600'`). `init.tracks` is a list of trackIds to open.
This is the same `init` shape JBrowse Web serializes into its `?session=spec-…`
[URL query parameter](https://jbrowse.org/jb2/docs/urlparams/), passed directly.

Worth knowing: `init` only runs once, when the view is first created — think of
it like an input's `defaultValue`. Re-rendering with a different `loc` won't
move the view; it keeps wherever the user has panned or zoomed to. To drive the
view after it's mounted (a "jump to gene" button, search results, syncing to the
URL), grab a `ref` and call its navigation actions instead — see
[external navigation](../navigate-to-location/#external-navigate).

Adapters accept a plain `uri` shorthand: JBrowse derives the standard index file
(e.g. [`.bam.bai`](https://jbrowse.org/jb2/docs/config/bamadapter/),
[`.gff3.gz.tbi`](https://jbrowse.org/jb2/docs/config/gff3tabixadapter/))
automatically, so you rarely spell out the nested `bamLocation`/`index` form.
The full config shape is in the
[config guide](https://jbrowse.org/jb2/docs/config_guide/).

See [Advanced init](../session-setup/#with-init-advanced) for per-track display
snapshots and view-level settings (cytobands, gridlines, colorByCDS, …), and
[Default session](../default-session/#default-session) for the full imperative
snapshot form.
