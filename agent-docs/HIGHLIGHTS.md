# webgl-poc highlights — what people will actually notice

`agent-docs/MERGE-SUMMARY.md` is the area-by-area engineering changelog. This
doc is the other direction: pretend you're a JBrowse user (or someone skimming
release notes) and ask "what changed for me?" Most of the branch is a rendering
*foundation* rewrite, but a huge amount of user-facing feature work landed on
top of it. Below is the stuff worth calling out, roughly ordered by how many
people will notice it.

## Smooth, instant zoom and pan

This is the headline. Every track now uploads its data to the GPU once, then
zooming/panning redraws from that GPU data instead of re-fetching and
re-rendering from scratch. The practical effect: scroll-zoom and click-drag
panning are continuous and immediate on every track type (alignments, wiggle,
variants, MAF, Hi-C, synteny, dotplot, arcs...), including on large/whole-genome
views that used to feel sluggish. Browsers without WebGPU/WebGL2 still work —
they fall back to a Canvas2D renderer with the same behavior, just without GPU
acceleration.

## Alignments: grouping, methylation, and new view modes

The alignments track picked up the largest set of new analysis features:

- **Group-by sample/tag/chain** — split one alignments track into multiple
  per-group pileup/coverage/arc bands, each independently resizable, with
  sticky group labels and a shared color/Y-scale across groups.
- **Methylation / base-modification overhaul** — per-modification-type
  visibility toggles, "show only" and two-color modes, bisulfite/EM-seq color
  mode, CpG/CHG/CHH context support, and a per-read modification detail widget.
- **SAMplot mode** — a discordant-pairs-only paired-arc view with a
  samplot-style axis.
- **Sashimi junction arcs** with filtering by minimum read support.
- **Per-base-quality coloring**, plus a "color by tag" / "group by" scheme
  registry.
- A floating read legend that reflects what's actually on screen, and an option
  to disable low-frequency mismatch filtering.

## New plugin: GWAS + LocusZoom-style LD coloring

A brand-new `gwas` plugin (didn't exist on `main` at all): a GPU Manhattan-plot
display, plus LD (linkage disequilibrium) coloring backed by a new PLINK `.ld`
adapter. Right-click a variant to "Color by LD to this SNP" and re-anchor the
LocusZoom-style view in one click. Ships with a real demo (SLE summary stats at
STAT4/IRF5/UBE2L3, hg19) linked from the welcome page.

## Synteny, dotplot, and structural variants

- New **synteny coloring modes**: by identity, mapping quality, mean query
  identity, or opacity-by-identity, configurable at the view level.
- **Dotplot**: lock-aspect-ratio toggle, cursor-anchored wheel zoom, interactive
  highlight chips, and round-capped GPU line rendering.
- New comparative adapters: indexed **PAF** (`TabixPAFAdapter`) and all-vs-all
  PAF/session generation for large multi-genome comparisons.
- Reworked import forms for synteny/dotplot/breakpoint-split-view (pairwise vs.
  pangenome toggle, easier assembly selection, handles single-breakend/N
  regions).

## MAF (multiple alignment format) is now built-in

The MAF plugin moved in-tree and was rebuilt on the new pipeline:

- Shared tree sidebar with haplotype-aware sample resolution, auto-discovery,
  and in-session row reordering.
- `bigMafSummary` for fast zoomed-out rendering of large alignments.
- Better tooltips (styled table instead of raw HTML), an interbase-indicator
  histogram, and `N` bases now shown distinctly in the coverage histogram.

## Variant / multi-sample views

- Virtual scrolling and auto-height for the multi-sample variant matrix —
  smoother with large sample counts.
- Reversed-region support throughout (including SVG export).
- Better SV/breakend descriptions (SVLEN alongside symbolic ALT, CHR2:END for
  translocations).

## Hi-C

User-facing resolution controls: pick the contact-matrix resolution directly,
with auto-tracking on zoom and the resolution buttons disabled at the available
bounds.

## Bookmarks and highlights

Bookmarks can now be **shared via the session** (so they travel with shared
session links), and the bookmark panel was redesigned as a Gmail-style grid with
inline single-click editing.

## Adding and managing tracks

- The "Add track" workflow is now grouped by category with clearer "Add…"
  labels, plus a new **bulk add-tracks** workflow (paste/enter many tracks at
  once).
- Auto-detection for more file types (STAR-Fusion TSVs, Pan-UKB GWAS-style BED).
- Bad or pasted-in track configs now show a friendly error instead of crashing
  or silently doing nothing.
- "Copy and open track" alongside the existing "Copy track".

## Display and navigation niceties

- **Collapse introns** for gene/transcript tracks.
- Compact / super-compact display modes, generalized into an "All tracks" group
  menu (was "Compact all tracks").
- "Reverse region" action on the scalebar.
- Multi-wiggle **group-by** with a hierarchical-clustering dendrogram.
- GC-skew mode on the GC content track.
- Auto-fit-height toggle with a scroll-aware overflow indicator for tracks with
  many rows.

## Export

- SVG export now reuses the exact same drawing code as the on-screen Canvas2D
  renderer, so exported SVGs match what you see on screen (previously a
  separate, drift-prone SVG path).
- `jbrowse-img`: `--out file.pdf` actually produces a PDF now (it silently wrote
  SVG bytes before); new `--spec` flag renders N-way comparative/synteny images
  in one shot; new alignment display modifiers (`arcs`, `samplot`,
  `linkedReads`, `sashimi`).

## Embedded components (react-linear-genome-view, etc.)

New **managed, prop-driven** components for LGV, circular view, and the
embedded app — configure via props and a declarative `init` field instead of
hand-building and mutating an MST model. Drawer-widget support was also added to
embedded views.

## Desktop app

Reworked Open Sequence dialog (guided vs. bulk forms, genome staging), a
refreshed start screen, and an auto-update dialog on manual update checks.

## Website and docs

The docs site moved to a new Astro-based design, and config/state-model/API
reference docs are now auto-generated from source (so they can't drift). Most
user-guide screenshots were regenerated against real data on the new rendering
pipeline.

---

## Breaking changes for plugin & embedded developers

Most existing sessions/configs migrate automatically via `preProcessSnapshot`
(e.g. canvas `color1/2/3` → `color`/`connectorColor`/`utrColor`, `outline` →
`outlineColor`, `heightPreConfig` → `heightOverride`). But a few changes have no
migration path and will break third-party plugins:

- **The renderer registry is gone.** `CoreRender` RPC, the renderer registry,
  and the server-side renderer/canvas classes were removed entirely — core no
  longer renders on the server. Any plugin that registered a custom
  `RendererType` or hooked into that pipeline needs to be rewritten against the
  new GPU display architecture (`RenderLifecycleMixin`/`DisplayChrome`); there's
  no compatibility shim. This is expected to be the most painful part of the
  upgrade for plugin authors with custom renderers.
- **Display-type collapse.** Pileup / SNPCoverage / ReadArcs / ReadCloud
  collapsed into one `LinearAlignmentsDisplay`. Old `type:` strings in saved
  configs still resolve (relocated types kept their registered `name`), but
  plugins that extended or referenced the old display classes directly will need
  updating.
- **Config-slot renames.** End-user session/config JSON migrates automatically,
  but plugin *code* that reads renamed slots directly (e.g.
  `getConf(self, 'color1')`) needs updating to the new names.

## What *didn't* make it

A few experimental efforts were built during this branch and then deliberately
removed before merge: a pangenome/GFA graph-genome viewer + tube-map view, the
`lollipop` plugin, and a large multi-genome HPRC synteny dataset. Worth knowing
about if anyone asks "what happened to X" after seeing it in branch history.
