# graphgenomeview screenshot fixture

Backs the `pangenome/graph_rgfa` screenshot spec
(`website/scripts/specs/graph.ts`), which renders the third-party
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer)
(view type `GraphGenomeView`) — not bundled in JBrowse Web.

Six configs live here, data-free but for one gene slice:

- `config.json` — K12 only, the minimal graph fixture. It is also the start
  state of both E. coli paste tours (`pangenome/pggb_subgraph_launch` and
  `pangenome_cactus/subgraph_launch`), which add `ecoli_pggb_segments` and
  `ecoli_cactus_segments` from their own page's fence, so it carries the same
  constraint `hprc_tour.json` does below: **give it no `tracks`**. A tour
  supplies the K12 gene lane as a session track instead.
- `hprc.json` — hg38 plus the HPRC release 2 graph, bubble, allele and callset
  tracks.
- `hprc_tour.json` — the same hg38 and the same plugin with **none** of those
  tracks, which is the state a reader of `pangenome_hprc` is in before the page
  adds its first one. `pangenome/hprc_end_to_end` films the track being added
  from here through **Open track... → Add track from pasted JSON**, so the
  fixture must not already carry `hprc_minigraph_segments`: a pasted config
  whose `trackId` is taken is rejected rather than merged
  (`doPasteConfigSubmit`). It is also the tour's live link, so a reader who
  watched the route opens the session it started in and can walk it.
- `ecoli_pangenome.json` — all five E. coli strains as assemblies, their gene
  tracks, the all-vs-all synteny track, and the rGFA segments track. This is the
  only fixture where a contributing assembly of the graph is also a loaded
  assembly, which is what the graph view's outbound launch needs: a node can
  open the strain it came from, and the whole window can open as a synteny view
  of the strains that contribute to it. Derived from the hosted
  `demos/ecoli_pangenome/config.json` by keeping the assemblies, genes and
  `ecoli_pggb_ava`, and adding the plugin plus the rGFA track.
- `hprc_haplotype.json` — hg38, its genes, the HPRC segments track, and one
  contributing haplotype loaded as an assembly: NA20809 haplotype 2 from its
  UCSC GenArk hub (GCA_044166615.1), as `NA20809.2` with the graph's `NA20809#2`
  among its aliases. GenArk names the 2bit's sequences by GenBank accession,
  which is how the graph names a haplotype's contigs too, so the node menu's
  **Open in NA20809.2** resolves with nothing translated. Its gene lane is
  `hprc_mhc_NA20809.2.genes.gff3.gz`, HPRC's CAT annotation of that haplotype
  sliced to `CM094351.1:32,300,000-32,800,000` with the command the tutorial
  prints (GenArk's own gene lanes are empty around the allele). Backs
  `pangenome/hprc_haplotype_launch` and the `pangenome/hprc_out_to_haplotype`
  tour; `hprc.json` deliberately does not carry the assembly, since the extra
  `Open in` rows would change the node menu the MHC layout figure captures.
- `hprc_hs1.json` — hg38 and hs1 (T2T-CHM13, the committed `hs1.chrom.sizes`)
  with both gene tracks, the segments track on both assemblies, and UCSC's
  hg38-to-hs1 liftOver as a synteny track. Backs
  `pangenome/hprc_synteny_launch`, the graph's own **Launch → Linear synteny
  view** at the CHM13 window. It cannot be `hprc.json`: that fixture loads four
  more haplotypes for the CFHR and inversion figures, one of which contributes
  at that window too, so the launch there offers three assemblies and a track
  submenu, and the stack it opens has a panel the liftOver aligns nothing to.

The plugin bundle is served from `jbrowse.org/demos/graphgenomeviewer` and the
GFA slices from `jbrowse.org/demos/ecoli_pangenome`, so no build output and no
`ecoli_*` data is vendored into the repo (both are gitignored on purpose — the
E. coli data is built by `scripts/build_ecoli_pangenome_graph.sh`).

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
relative to its own url via `import.meta.url`, so the whole `dist/` tree must be
uploaded together, preserving the `chunks/` subdirectory. Publish with the
plugin's own `pnpm betabuild`, never by hand: it gates on lint, typecheck and
tests, sets Cache-Control, invalidates the edge, and then verifies what the CDN
actually serves.

**Every config here names the plugin's unversioned `esmUrl`**, the entry point
every betabuild rewrites, which is also what the `demos/` configs name and what
the tutorials tell a reader to install. So a plugin publish moves the graph
figures with no commit here to attribute it to; the next regen's
`pnpm figures:report` is where that move is read, and a spec that clicked a
label the plugin renamed fails there rather than silently. The fixtures pinned a
content-addressed build (`demos/graphgenomeviewer/<hash>/`, which betabuild
still writes) until 2026-09-06; pinning cost a bump nobody remembered, and
`demos/hprc/config.json` went stale twice that way. `pnpm check-live-configs`
refuses a pin in either place.

Once the plugin is on npm, point `esmUrl` at a pinned version there instead.

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
