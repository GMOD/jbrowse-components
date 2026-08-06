An `assembly`, a list of `tracks` and an `init` for what to open go straight to
`<CircularGenomeView>` as props — no `createViewState`. The config reuses the
JBrowse format with one difference: a single `assembly` rather than an
`assemblies` array.

The props are **initial values, read once on mount**. To open a track in
response to a runtime event, or to reach the engine imperatively, use the
unmanaged `createViewState` flow — see [show a track](../show-track/).

Config fields are under [docs/config](https://jbrowse.org/jb2/docs/config/),
view snapshot properties under
[CircularView](https://jbrowse.org/jb2/docs/models/circularview/).
