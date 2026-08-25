---
name: region-view-launch
description: Launching another view type on a locus (synteny stack, graph subgraph) from a linear view. The shared convention, where the two launchers diverge, and what is still open. Read before adding a "open view X for this region" entry point.
---

# Launching a view on a region

Two launchers implement the same idea from opposite ends of the plugin
boundary: **take a locus in a linear view, open a different kind of view on
it, sourced from some track**.

- **Linear synteny** — in this repo,
  `plugins/linear-comparative-view/src/LaunchSyntenyView/`.
- **Graph genome** — external repo,
  `~/src/jb2plugins/jbrowse-plugin-graphgenomeview/src/launchSubgraph/`.

The graph one came first and is the reference implementation. The synteny one
was written to match it deliberately rather than invent a second convention.
Read the graph plugin's `linearViewMenuItems.ts` before adding a third.

## The convention

1. **Hook `Core-extendPluggableElement`**, not a display-specific seam. Override
   `menuItems()` (visible region) and/or `rubberBandLaunchMenuItems()`
   (selection) on `LinearGenomeView`; override
   `trackMenuItems()`/`contextMenuItems()` on a `DisplayType` when the entry
   point belongs to one track.
2. **Discover from tracks, not from displays.** Read track *configs* — the graph
   plugin scans `session.tracks` via `allSessionTracks`, so connection tracks
   count. This is why a display-contributed `regionLaunchItems()` seam was
   considered and rejected: it cannot serve a track with no display.

   **How wide to scan is the launcher's call, and the two answer differently.**
   The graph plugin goes session-wide — *"The graph track need not be in the
   view, or even turned on… before, the only entry point was the menu of a track
   they might never have opened."* Synteny is **view-scoped**
   (`launchableTracks` filters the launching view's own open tracks) because a
   config is free to declare a dozen synteny tracks with none of them open, and
   session-wide put all of them in the dialog's selector with the first in
   *config order* preselected — a choice the user never knowingly made, deciding
   a panel list they have no way to judge. Sorting the open ones first didn't
   help the case that needed it, which is the one where none are open. What
   synteny gives up is a configured-but-closed track, and that is what the import
   form behind Add → Linear synteny view is for. Read the comment on
   `launchableTracks` before widening it back.
3. **Discover by declared capability, not adapter name.** The graph plugin
   checks `pluginManager.getAdapterType(t).adapterCapabilities.includes('getSubgraph')`
   (`RgfaTabixAdapter/index.ts:17` declares it). It hardcoded
   `GfaTabixAdapter`/`GfaServerAdapter` once and *"that is exactly what left it
   dead when those were removed."* Registration is checked first, because a
   session can hold tracks whose plugin isn't loaded and `getAdapterType`
   throws on an unregistered type.
4. **Always name the dataset the launch reads from — where it fits.** 0 capable
   tracks → no menu item at all, always. Which dataset a launch is cut from
   decides what the new view shows, so it is never left unsaid; *where* it is
   said follows how big the list can get:

   - **Bounded list** (consensus: alignments tracks open in *this view*, so one
     or two) → one entry whose submenu names each, a single track included.
     `launchTargetsMenuItem` (`@jbrowse/core/ui`, tested) is that shape.
   - **Unbounded list** (a session-wide scan has no ceiling) → a flat entry, and
     the dataset is a field of the dialog it opens. A cascading submenu of every
     capable track in a config is worse than the unnamed flat item it replaced.
     Synteny is this shape even though rule 2 narrowed it to the view's own open
     tracks: `LaunchSyntenyViewForRegionDialog` carries the dataset as its first
     field, where changing it refetches the panel list, and renders it as a line
     of text rather than a select when there is only one — a full-width select
     holding its only value is a control the reader has to try before ruling it
     out.

   A launcher with **no dialog** (the graph plugin) has nowhere to move the
   choice to, so it owes the submenu; it still branches on count inline in
   `subgraphMenuItems.ts`.
5. **Never push a launch entry into a menu top level.** In the view and track
   menus, group with `pushLaunchViewMenuItem` (`@jbrowse/core/ui`) so offers
   collect under one "Launch view" submenu. In the linear view's rubberband
   menu, extend **`rubberBandLaunchMenuItems()`** on the model rather than
   `rubberBandMenuItems()`: the view wraps whatever that returns in a "Launch"
   submenu (and omits the group entirely when it comes back empty), so the
   grouping is decided once, in `LinearGenomeView/menuItems.ts`, instead of by
   whichever plugin's `Core-extendPluggableElement` callback runs first. That
   menu used to take these flat and was up to seven entries.
6. **Take the widest block, never the first.** Both entry points hand the launch
   one region, but a linear view can be showing several: `dynamicBlocks
   .contentBlocks` and `getSelectedRegions()` both return display order, and a
   launched view is anchored on one stable sequence. A view scrolled just past a
   region boundary, or a rubberband dragged across one, puts a sliver first —
   `getSelectedRegions` returns `[{ctgA 49,998-50,001}, {ctgB 0-9,000}]` for a
   drag that is mostly ctgB (asserted in `LinearGenomeView/index.test.ts`), so
   `[0]` frames the launch on 3 bp of the region the user dragged away from.
   `widestRegion` (`regionLaunchMenuItems.ts`) and `widestBlock`
   (`launchSubgraphView.ts`) are that choice: widest by **bp** (a dynamic block
   carries `widthPx` and a selected region does not, and bpPerPx is uniform
   within a view, so the two orders agree), ties keep the leftmost.

   All four call sites had this wrong at some point, and on a launcher with a
   size guard it is silent rather than merely wrong: reading the sliver puts an
   illegal window under the cap, so the item renders enabled and cuts a
   degenerate graph instead of saying "zoom in". **No figure can cover this** —
   it needs a multi-region view and no spec has one. The unit tests are the
   coverage.

## Where they diverge

| | graph | synteny |
|---|---|---|
| dialog | none — menu click launches | yes — panel picker + window size |
| what persists | `loadedTrackId` + `loadedRegion` view props | resolved locstrings in `init` |
| size guard | `MAX_GRAPH_REGION_BP = 100_000`, disabled item + `disabledHelpText` | none |
| source linkage | `connectedViewId` → hover sync | none |
| entry points | view menu, rubberband, track menu, feature context menu | view menu, rubberband (a synteny row's included — it reads the bands' tracks, `launchableTrackConfs`, and offers to replace the stack), MultiWaySyntenyDisplay track menu, alignment context menu (pairwise, multi-panel on a track declaring 3+ assemblies, and the mate assembly alone in an LGV), feature-detail links (the same three), a MAF row's drag-selection menu (`launchMafRowSynteny`, ribbons cut from the columns) |

**The dialog split is real, not an oversight.** A subgraph is fully determined
by `(region, trackId)`, so there is nothing to ask. A synteny launch is not: the
set of assemblies aligning to a locus is only knowable by fetching, and their
top-to-bottom order changes which comparisons exist (ribbons draw between
*adjacent* panels only). Hence the RPC-backed picker.

**The persistence split is worth closing, in synteny's favour of graph's
model.** The graph launch writes a plain snapshot the view resolves when its
canvas mounts — the same path a reloaded session takes, so a launched view is
restorable for free and the menu does no RPC. The synteny launch bakes resolved
locstrings, so a reload cannot re-derive it and the dialog must do the RPC
up-front. Persisting `(trackId, region, ordered assembly list)` and letting the
view resolve would align them and move the picker into the view.

## Open ideas, roughly by value

**Pair the two launches on one selection — the data half is done.** An
all-vs-all PAF and a pangenome graph are two representations of the same
alignment, and both plugins extend `rubberBandLaunchMenuItems()`, so a view
with `ecoli_ava` and a segments track open offers both from one drag. The
hosted `jbrowse.org/demos/ecoli_pangenome/config.json` carried no rGFA track
when this was first written; as of 2026-08-25 it carries
`ecoli_minigraph_segments` and `ecoli_pggb_segments` beside `ecoli_ava` (curl
it — it is hand-uploaded and never regenerated). `pangenome_ecoli.md` says so
under "Browsing the whole graph by locus"; what is missing is a figure of the
paired menu, which no spec films.

**The graph's `connectedViewId` cannot name a synteny row.** A graph launched
from a row's rubberband records the row's id, and the plugin's
`linearViewTarget` / `graphViewHighlights` read `session.views` only — a row is
not in it. Hover highlights still land (the row asks with its own id), but
"Open in K12" from a node opens a new pane instead of scrolling the row.
Cross-repo; the fix is a walk into `views[]` of any view in the session.

**Drop the graph plugin's inline count-branching copy** in favor of
`launchTargetsMenuItem`, now that the helper lives in `@jbrowse/core/ui` beside
`pushLaunchViewMenuItem`. Cross-repo, so it lands behind a version bump — see
`reference/PLUGIN_ABI_STABILITY.md`. Until then the graph offer is flat for a
single dataset where the in-repo ones name it. That plugin has the unbounded
list too (session-wide discovery) with no dialog to move it into, so the real
question there is whether the launch should grow one.

The other half of that old note is done: the LGV now collects rubberband offers
itself through `rubberBandLaunchMenuItems()`, so plugins no longer each
override `rubberBandMenuItems()` and fight over placement.

**Give synteny a size guard.** A rubberband is bounded by the viewport, but the
*visible region* entry is not — at whole-chromosome zoom the discovery RPC is a
whole-genome `CoreGetFeatures` against an all-vs-all track. Measure before
picking a cap; the graph plugin's pattern (disabled item carrying the size in
`disabledHelpText`, so the limit is read before clicking rather than notified
after) is the one to copy. Note the repo-wide preference is helpText over
`disabled` — the graph plugin argues the opposite for a hard cap, and that
argument only holds where there *is* a hard cap.

**`connectedViewId` for synteny.** The graph plugin pairs launched↔source views
for hover sync (`hoverSync/graphViewHighlights.ts`). A synteny stack launched
from a locus could highlight back into the LGV it came from.

**Synteny track menu entry.** The graph plugin offers "(this region)" from the
graph track's own menu; `MultiWaySyntenyDisplay` has one, `LGVSyntenyDisplay`
reaches the same dialog from a block's right-click instead.

**The closed-track case, honestly.** `launchableTracks` went open-tracks-only
because a session-wide list preselected the first dataset in config order. The
objection was to the preselection, not to the offer: an entry that appears when
no synteny track is open, with the dataset select empty and required, restores
the "browsing genes, want to compare" route the graph launcher has without
deciding a panel list the user cannot judge. A product call.

**MAF rows as a synteny launch — shipped**, pairwise, as
`launchMafRowSynteny` (plugins/maf): the ribbons are cut from the MAF's own
columns and no adapter is involved. [MAF_CROSS_VIEW_NAVIGATION.md](MAF_CROSS_VIEW_NAVIGATION.md)
has the design, including why the all-samples stack is not offered and why the
`FromConfigAdapter` store holds the reference-anchored side only.

## Gotchas

- **A CIGAR-less alignment is still clipped to the selection, by interpolation.**
  `resolveSpans` (`resolvePanel.ts`) walks the CIGAR when there is one
  and interpolates across the block when there is not — which is not a lesser
  approximation of the walk, it is the geometry the block is already *drawn*
  with (no per-base correspondence is known, so the ribbon is a straight
  quadrilateral between the two blocks' corners). Framing on the whole block
  instead, which is what this did, ignored the selection outright: a rubberband
  over one gene of a megabase-long asm5 block opened the whole megabase on both
  sides with no sign of it. Not an edge case — a PAF from minimap2 without `-c`
  carries no `cg`, and neither do MashMap, MCScan or the coarse PIF tier. The
  discovery RPC states no `lodMode`, and the PIF adapters read fine on no stated
  mode, so the *region* launch always has CIGARs off a tiered PIF; the pairwise
  right-click launch is where a coarse feature can reach this.
- **A panel is every block its mate aligns the region with, not the widest
  one.** `pickMatesForRegion` groups rather than reduces, and `resolvePanel`
  unions the resolved spans. Several blocks per mate is the *normal* case: an
  HSP table (BLAST tabular) and a gene-anchor table (MCScan) are one row per
  hit, so any locus worth selecting is already dozens of them, and a minimap2
  PAF splits at every structural difference. Keeping the widest framed that
  panel — and, through the anchor row's union of what the panels resolved to,
  the whole launched view — on one block: `ctgA:1,001..5,000` launched as
  `ctgA:3,001..5,000`, silently. Three rules keep the union from running away.
  Two belong to "a panel opens on one stable sequence": the mate **contig**
  covering most of the region wins and the others are dropped, and the panel
  opens reversed only when the minus strand carries most of the alignment. The
  third is `keepNearMedian`, shared with the multi-way lane frame: on the
  winning contig a hit further than 1.5 regions from the length-weighted median
  is repeat noise and is dropped — one stray orthogroup hit otherwise stretched
  brachypodium to `1:5,237,628..54,451,482` for a 185 kb rice window. The
  whole-block launch (no region) has no unit to scale the reach by and keeps
  every hit.
- **The coordinates are resolved in the worker, and only the coordinates cross
  the RPC.** `SyntenyDiscoverMates` returns `ResolvedPanel[]` — six numbers and
  two names per mate assembly — rather than the alignments behind them. The
  CIGAR is the one field the resolution needs and the one whose size is
  unbounded (an asm5 PAF block's `cg` tag alone runs to 100 KB), so with a panel
  now spanning *every* block at the locus, shipping alignments would have made
  the wire scale with the selection: a whole-chromosome visible-region launch
  against an HSP table is tens of thousands of blocks. It also puts the dialog's
  preview and the launched view on literally the same numbers, which is what the
  two rounded differently before. **Round outward, in `resolvePanel` and nowhere
  else** — a viewport edge and an interpolated block both land mid-base, and a
  span rounded in is a view that opens inside the row the user read.
- **A mate that is not a declared assembly is dropped from the launch, and the
  dialog has to say so.** `assemblyForPanSNName` falls back to the bare PanSN
  sample name when the config declares no assembly for it, so an all-vs-all file
  hands back mates the display happily draws (tested, deliberate — you need only
  load the assembly you are viewing) and the launch cannot open a panel on.
  `pickMatesForRegion` therefore returns `{ mates, unconfigured }`: reporting
  those as "nothing aligns to this region" contradicts the lanes the user can
  see drawn in the track they just launched from. The sibling failure — the
  *anchor's* own name not matching a PanSN prefix — is now an adapter error
  (`noPanSNMatchError`, `plugins/comparative-adapters/src/util.ts`) rather than a
  configured track that draws nothing and reports nothing: both all-vs-all
  adapters answer `hasDataForRefName` with `true` unconditionally, so nothing
  filters it out. The prefixes are the one thing no add-track form or config
  editor lists, so the error carries them. Verified against every hosted E. coli
  demo file before shipping the throw — `tabix -l <url> | cut -c2- | cut -d'#' -f1
  | sort -u` is the check.
- **A launch RPC that does not rename its region silently opens an empty view.**
  Fixed in the graph plugin (`GetSubgraph` now extends
  `RpcMethodTypeWithRenameRegion`), but read this before writing the next
  launcher, because nothing about the failure points at the cause. JBrowse maps a
  region's refName onto the adapter's own names before calling `getFeatures`,
  which is why an rGFA segments track draws on an hg38 assembly whose contigs are
  `6` while the graph's stable names are `GRCh38#0#chr6`. A plain `RpcMethodType`
  gets no such mapping, and `resolveRefName`
  (`RgfaTabixAdapter/rgfaBed.ts`) matches only the graph's own spelling, so the
  launch resolved nothing while the track it launched from kept drawing: the
  graph looked broken, its own data looked fine, and nothing raised an error.
  Every hosted GRCh38 FASTA on jbrowse.org uses bare `1`/`6` names,
  `hg38.prefix.fa.gz` included, so this was the default human case, not an edge
  case; E. coli escaped it because the assembly's `chr` matches `K12#1#chr`. Note
  `renameRegionsIfNeeded` (`packages/core/src/util/renameRegions.ts:67`) already
  throws on the near-miss of pairing a singular `region` with the *plural* base
  class, and its comment names this same bug — but a method extending plain
  `RpcMethodType` never calls it, so the guard cannot fire.
- **Both graph adapters live in the plugin repo now**, not here:
  `RgfaTabixAdapter` and `MinigraphBubbleAdapter` moved out with the view, so
  `plugins/comparative-adapters` no longer has them and nothing in this repo
  registers those types. What is left here is `scripts/build_rgfa_tabix.sh`, the
  tutorials, and `website/scripts/specs/graph-ecoli.ts`. The plugin's own
  `RGFA_GRAPH_HANDOFF.md` still tables them under
  `plugins/comparative-adapters/src/` and is stale on this point.
- **Subgraphs are rGFA-only.** `RgfaTabixAdapter` declares `getSubgraph`;
  `MinigraphBubbleAdapter` reads a summary index and cannot cut one. The graph
  plugin's feature context menu handles this by falling back to *other* session
  graph tracks — a bubble is the most natural thing to right-click and is
  exactly the thing that can't serve the cut. Minigraph-Cactus: `sv.gfa` is
  rGFA, plain `.gfa` is not; pggb/odgi needs `odgi extract`.
- **Menu rows have stable testids**, built by `makeTestId` in
  `packages/core/src/ui/CascadingMenu.tsx`:
  `cascading-submenu-<label>` / `cascading-menuitem-<label>`, lowercased with
  whitespace → `_`. Screenshot specs and tests must use these, **not** text:
  a track's name is usually also its label in the view, and a text match
  resolves to the first visible match, which is that label.
- **Launching by `session.addView` bypasses invariants.** Synteny routes through
  `launchSyntenyView` (`packages/synteny-core`), which owns the "≥2 views"
  check; there is no equivalent guard on the graph side because a graph view
  needs no pairing.
- **`getSession()` throws on a track *config* node.** Session-wide discovery
  hands you `AnyConfigurationModel`s, which are not under the session in the
  state tree (connection configs are not even under the config root). Pass the
  session in. This cost a debugging cycle; it fails as
  `Error: no session model found!` rendered *inside* the dialog, so it looks
  like an empty result rather than an exception.

## Verifying a launcher

Unit tests cover the pure parts (`launchTargetsMenuItem`, `panelOrder`,
`pickMatesForRegion`, `resolvePanel`, `buildSyntenyViewSpec`). They are not enough — the jsdom
integration test in `products/jbrowse-web/src/tests/LGVSynteny.test.tsx`
("launch a multi-panel synteny view from a region selection") drives
`view.rubberBandMenuItems()` through the real extension point and asserts the
launched view's assemblies, and it still missed that nothing *rendered*.

What caught the remaining bugs was generating the figure
(`multiway_synteny/ecoli_launch_from_selection`, a `stages` spec; see
`website/scripts/screenshot-review-plan.md` for the regen loop). Pick the demo window with
care: the first render landed inside the paa operon island, the one locus where
three of four strains have no alignment at all, so discovery correctly returned
a single mate and the multi-panel launch degenerated to the pairwise case it was
meant to contrast against.

The graph launcher now has the same coverage from this repo, in
`website/scripts/specs/graph-ecoli.ts`: `pangenome/rgfa_launch_menu` drives the track
menu, and `pangenome/rgfa_segment_neighbourhood` drives the feature context menu
and then the Color dropdown on the view it launched. Both assert nothing but a
picture, so review them by eye after a regen. Three things they taught:

- **Pick the clicked feature from the index, not by eye.** Right-clicking a
  segment with no rank>0 neighbour cuts a neighbourhood that is a straight run of
  backbone — the launcher working correctly, and a figure that teaches nothing.
  `tabix ecoli_minigraph.links.bed.gz K12#1#chr:4050000-4100000` names the
  segments with alleles hanging off them.
- **Target the feature's rendered label, not a viewport coordinate.**
  `[data-testid="feature-name-<label text>"]` is emitted by
  `plugins/canvas/src/LinearBasicDisplay/components/overlayElements.tsx`
  alongside a `data-feature-id` the display's delegated handler resolves, so a
  right-click spec needs no hand-measured pixels.
- **A graph canvas is too sparse for the content-stable diff gate.** It is mostly
  white with thin strokes, so switching `pangenome/hprc_c4_subgraph` from the
  anchored layout to the force layout moved 2.7% of pixels and was *kept* rather
  than written. Force-layout figures carry `diffThreshold: 0.1` for FMMM jitter,
  which cannot be told apart from a real change of that size — regenerate those
  with `--force`.

**The figures can only cover what is deployed.** Both tutorials load the plugin
from `jbrowse.org/demos/graphgenomeviewer`, and that bundle is code-split, so
audit it by grepping the entry *and every chunk it references* (the color-scheme
labels live in a chunk, not the entry):

```bash
curl -s https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js \
  | grep -c 'Graph genome view (visible region)'
md5sum ~/src/jb2plugins/jbrowse-plugin-graphgenomeview/dist/*.esm.js   # vs the hosted one
```

As of 2026-07-26 the hosted bundle carries all four launch labels, both halves of
the hover sync, and the convention-6 fix (plugin `3146de4`, published by
`jbrowse-plugin-graphgenomeview/scripts/betabuild.sh`, entry md5
`0ce050e42b363d281fbc217f6afbab54`). The script
ends by downloading what the CDN actually serves and diffing it against what it
built, which is the check worth trusting — an S3 write alone left the edge
serving the old entry point for 8+ hours once.
