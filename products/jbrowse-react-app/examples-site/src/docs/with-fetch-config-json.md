When the config lives on a server — or differs per environment, user or route —
fetch it before `createViewState`, and hold the result in state so React renders
once it resolves.

As with a [bundled config](../loading-config/#with-import-config-json), URIs in
the file resolve relative to where it was downloaded from, so tag each location
with a `baseUri` after fetching. Shape:
[JBrowseRootConfig](https://jbrowse.org/jb2/docs/config/jbrowserootconfig/).
