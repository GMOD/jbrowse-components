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
  contributing haplotype loaded as an assembly: HG01433 haplotype 2 from its
  UCSC GenArk hub (GCA_042027645.1), under its PanSN sample name `HG01433.2`.
  GenArk names the 2bit's sequences by GenBank accession, which is how the graph
  names a haplotype's contigs too, so the node menu's **Open in HG01433.2**
  resolves with nothing translated. Its gene lane is
  `hprc_mhc_HG01433.2.genes.gff3.gz`, HPRC's CAT annotation of that haplotype
  sliced to `CM086511.1:32,300,000-32,800,000` with the command the tutorial
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

**Every config here pins `esmUrl` to a content-addressed prefix**
(`demos/graphgenomeviewer/<hash>/`), which every betabuild writes alongside the
unversioned entry point and prints at the end. The plugin lives in another repo,
so an unpinned url means a deploy changes every graph figure with no commit here
to attribute it to — that is how a renamed Color dropdown label broke
`pangenome/rgfa_segment_neighbourhood`, whose spec clicked the old text, and the
failure read as a spec bug. Bumping the pin is a one-line reviewable diff;
regenerate the graph figures in the same commit.

The unversioned url stays current, and it is what the **demo** configs under
`demos/` name and what the tutorials tell a reader to install. That split is the
same argument from both ends: a figure must not change without a commit here to
attribute it to, and a visitor opening a demo wants the build the docs just told
them to install. Pinning a demo instead buys nothing and costs a bump nobody
remembers — `demos/hprc/config.json` went stale twice that way, once two builds
behind and once one, while `demos/ecoli_pangenome/config.json` never has.
`pnpm check-live-configs` holds both halves.

Once the plugin is on npm, point `esmUrl` at a pinned version there instead.
