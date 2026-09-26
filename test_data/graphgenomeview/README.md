# graphgenomeview screenshot fixture

Backs the `pangenome/graph_rgfa` screenshot spec
(`website/scripts/specs/graph.ts`), which renders the third-party
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer)
(view type `GraphGenomeView`) — not bundled in JBrowse Web.

Four configs live here:

- `config.json` — K12 only, the minimal graph fixture. It is also the start
  state of both E. coli paste tours (`pangenome/pggb_subgraph_launch` and
  `pangenome_cactus/subgraph_launch`), which add `ecoli_pggb_segments` and
  `ecoli_cactus_segments` from their own page's fence, so **give it no
  `tracks`**. A tour supplies the K12 gene lane as a session track instead.
- `hprc.json` — hg38 plus the HPRC release 2 graph, bubble, allele and callset
  tracks.
- `ecoli_pangenome.json` — all five E. coli strains as assemblies, their gene
  tracks, the all-vs-all synteny track, and the rGFA segments track. This is the
  only fixture where a contributing assembly of the graph is also a loaded
  assembly, which is what the graph view's outbound launch needs: a node can
  open the strain it came from, and the whole window can open as a synteny view
  of the strains that contribute to it. Derived from the hosted
  `demos/ecoli_pangenome/config.json` by keeping the assemblies, genes and
  `ecoli_pggb_ava`, and adding the plugin plus the rGFA track.

The plugin bundle is served from jbrowse.org's plugin store and the GFA slices
from `jbrowse.org/demos/ecoli_pangenome`, so no build output and no `ecoli_*`
data is vendored into the repo (both are gitignored on purpose — the E. coli
data is built by `scripts/build_ecoli_pangenome_graph.sh`).

The config is served **same-origin** with the app by the screenshot server, and
that is the whole point: jbrowse-web only raises the cross-origin plugin-trust
dialog when the _config_ origin differs from the app's (`SessionLoader.ts`), so
a same-origin config loads the plugin with no dialog to click in a headless
capture. The plugin url itself may be anywhere.

The plugin is a native ES module, loaded via `esmUrl`. Two things it depends on:

- its default export is the Plugin class (ESM has no `JBrowsePlugin<name>`
  global to match), but `plugins[].name` here must still equal the view type
  `GraphGenomeView` so the config's session spec resolves the view;
- it externalizes `@mui/material/SvgIcon` and reads `createSvgIcon` off it,
  which the host only provides as of GMOD/jbrowse-components#5606.

The entry loads its code-split chunks (including the Bandage WASM layout engine)
relative to its own url via `import.meta.url`, and the store rehosts the
package's whole `dist/` tree, `chunks/` included. Publish with the plugin's
`pnpm version patch`, never by hand: its preversion gates on lint, typecheck,
tests and a boot of the built bundle on hosted releases, and the pushed tag's CI
run publishes to npm. It reaches the configs here once the `GraphGenomeView` pin
in jbrowse-plugin-list names it and `pnpm dep` runs there.

**Every config here names the store's `latest/` `esmUrl`**, which is also what
the `demos/` configs name and what the tutorials tell a reader to install. So
bumping the release jbrowse-plugin-list pins for `GraphGenomeView` moves the
graph figures with no commit here to attribute it to; the next regen's
`pnpm figures:report` is where that move is read, and a spec that clicked a
label the plugin renamed fails there rather than silently. The fixtures pinned a
content-addressed betabuild (`jbrowse.org/demos/graphgenomeviewer/<hash>/`)
until 2026-09-06; pinning cost a bump nobody remembered, and
`demos/hprc/config.json` went stale twice that way. That betabuild prefix
retired on 2026-09-24 and unpkg on 2026-09-25, and `pnpm check-live-configs`
refuses any url but the store's `latest/` one in either place.

**The corollary, which costs a five-minute timeout per figure to learn the hard
way: an unversioned `esmUrl` means a STALE local `jbrowse-web` build renders
every graph figure as a plugin load failure.** The published plugin tracks
`main` and links an unreleased `@jbrowse/render-core`, so a build older than it
does not carry what the plugin extends. The browser console says
`TypeError: Class extends value undefined is not a constructor or null`, the
plugin never registers, the view never draws, and the run then sits on
`TOOLBAR_READY` until `readyTimeout` — 300000 ms on the graph specs. Nothing in
that sequence names the cause, and the same run against a fresh build is fine.

Measured 2026-09-09: a `products/jbrowse-web/build` from 2026-08-02 against a
plugin bundle rebuilt that morning. So regenerate graph figures with
`pnpm screenshots:build` (which rebuilds first) rather than `pnpm screenshots`
whenever the build is not from today, and check
`stat -c %y products/jbrowse-web/build/index.html` against the plugin's
`Last-Modified` before concluding a spec is broken.
