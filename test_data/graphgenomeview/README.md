# graphgenomeview screenshot fixture

Backs the `pangenome/graph_rgfa` screenshot spec
(`website/scripts/specs/graph.ts`), which renders the third-party
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer)
(view type `GraphGenomeView`) — not bundled in JBrowse Web.

Only `config.json` lives here. The plugin bundle is served from
`jbrowse.org/demos/graphgenomeviewer` and the GFA slices from
`jbrowse.org/demos/ecoli_pangenome`, so no build output and no `ecoli_*` data is
vendored into the repo (both are gitignored on purpose — the E. coli data is
built by `scripts/build_ecoli_pangenome_graph.sh`).

The config is served **same-origin** with the app by the screenshot server, and
that is the whole point: jbrowse-web only raises the cross-origin plugin-trust
dialog when the _config_ origin differs from the app's (`SessionLoader.ts`), so
a same-origin config loads the plugin with no dialog to click in a headless
capture. The plugin url itself may be anywhere.

Two things the hosted bundle depends on:

- its UMD global is `JBrowsePlugin<config name>`, i.e.
  `JBrowsePluginGraphGenomeView` — it must match `plugins[].name` here, or the
  plugin loads but never registers;
- it externalizes `@mui/material/SvgIcon` and reads `createSvgIcon` off it,
  which the host only provides as of GMOD/jbrowse-components#5606.

The RPC worker resolves the sibling Bandage WASM layout chunk relative to the
bundle url, so it must be uploaded alongside it. Re-upload both with `aws s3 cp`
after rebuilding the plugin; once it is published to npm, point `umdUrl` at a
pinned version there instead.
