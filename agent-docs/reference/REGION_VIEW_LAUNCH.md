---
name: region-view-launch
description: Launching another view type on a locus (a synteny stack) from a linear view. The shared convention, where the synteny launcher diverged from the graph plugin's retired one, and what is still open. Read before adding an "open view X for this region" entry point.
kind: spec
---

# Launching a view on a region

**Take a locus in a linear view, open a different kind of view on it, sourced from
some track.** Linear synteny does this in
`plugins/linear-comparative-view/src/LaunchSyntenyView/`. The graph plugin's launcher
came first and synteny follows its convention; since plugin 4.0.0 the graph is a
track of the linear view (`LinearGraphDisplay`) and launches nothing, so its column
below is the record the synteny launcher was matched against.

## The convention

1. **Hook `Core-extendPluggableElement`**, not a display-specific seam. Override
   `menuItems()` (visible region) and/or `rubberBandLaunchMenuItems()` (selection) on
   `LinearGenomeView`; override `trackMenuItems()`/`contextMenuItems()` on a
   `DisplayType` when the entry point belongs to one track.
2. **Discover from tracks, not displays.** Read track *configs*, so connection tracks
   count. A display-contributed `regionLaunchItems()` seam was rejected: it cannot serve a
   track with no display. **Scan width is the launcher's call.** The graph plugin went
   session-wide; synteny is **view-scoped** (`launchableTracks` filters the view's open
   tracks) because a config may declare a dozen synteny tracks with none open, and
   session-wide preselected the first in *config order*, a choice the user never made.
   Synteny gives up a configured-but-closed track (the import form behind Add → Linear
   synteny view serves that). Read `launchableTracks`'s comment before widening it.
3. **Discover by declared capability, not adapter name**:
   `pluginManager.getAdapterType(t).adapterCapabilities.includes('getSubgraph')`.
   Hardcoded adapter names left the graph launcher dead when those adapters were removed.
   Check registration first: a session can hold tracks whose plugin isn't loaded and
   `getAdapterType` throws on an unregistered type.
4. **Always name the dataset the launch reads from, where it fits.** 0 capable tracks →
   no menu item. A **bounded list** (consensus: alignments tracks open in this view) → one
   entry whose submenu names each, a single track included (`launchTargetsMenuItem`,
   `@jbrowse/core/ui`). An **unbounded list** → a flat entry with the dataset as a field of
   the dialog; a cascading submenu of every capable track is worse than the unnamed item.
   Synteny is this shape: `LaunchSyntenyViewForRegionDialog` carries the dataset first
   (changing it refetches the panel list) and renders a line of text, not a select, when
   there is one. A launcher with **no dialog** owes the submenu.
5. **A launch is offered on the one assembly the source can be cut on, greyed out elsewhere
   naming it.** A graph track names its reference first (as `GbzBaseSyntenyAdapter` applies
   to its anchor), so the cut is offered only from that assembly's view and the view
   refuses the rest, so an old saved session cannot draw in the wrong frame. Offering all
   framed a GRCh38 backbone on a haplotype's own contig with no error.
6. **Never push a launch entry into a menu top level.** Group with
   `pushLaunchViewMenuItem` (`@jbrowse/core/ui`); in the rubberband menu extend
   `rubberBandLaunchMenuItems()`, which the view wraps in a "Launch" submenu (omitted when
   empty), so grouping is decided once in `LinearGenomeView/menuItems.ts`.
7. **Take the widest block, never the first.** `dynamicBlocks.contentBlocks` and
   `getSelectedRegions()` return display order, and a launched view anchors on one stable
   sequence. A rubberband dragged across a region boundary puts a sliver first
   (`[{ctgA 49,998-50,001}, {ctgB 0-9,000}]`, asserted in `LinearGenomeView/index.test.ts`),
   so `[0]` frames 3 bp of the region the user left. `widestRegion`
   (`regionLaunchMenuItems.ts`) and `widestBlock` (`launchSubgraphView.ts`) pick the widest
   by bp, ties leftmost. Under a size guard this is silent: the sliver puts an illegal
   window under the cap, so the item renders enabled and cuts a degenerate graph. **No
   figure can cover this** (no spec has a multi-region view); the unit tests are the
   coverage.

## Where they diverge

| | graph | synteny |
|---|---|---|
| dialog | none; menu click launches | yes: panel picker + window size |
| what persists | `loadedTrackId` + `loadedRegion` view props | resolved locstrings in `init` |
| size guard | `MAX_GRAPH_REGION_BP`, disabled item + `disabledHelpText` | none |
| source linkage | `connectedViewId` → hover sync | none |
| entry points | view menu, rubberband, track menu, feature context menu | view menu, rubberband (a synteny row's too, replacing the stack), MultiWaySyntenyDisplay track menu, alignment context menu, feature-detail links, a MAF row's drag-selection menu (`launchMafRowSynteny`) |

**The dialog split is real.** A subgraph is fully determined by `(region, trackId)`; the
set of assemblies aligning to a locus is only knowable by fetching, and their order
changes which comparisons exist (ribbons draw between *adjacent* panels only).

**The persistence split is worth closing, in the graph model's favour.** The graph writes
a plain snapshot the view resolves on mount (restorable for free, no RPC in the menu);
synteny bakes resolved locstrings, so a reload cannot re-derive and the dialog does the
RPC up front. Persisting `(trackId, region, ordered assembly list)` and letting the view
resolve would align them.

## Open ideas, roughly by value

- **A synteny size guard.** The *visible region* entry at whole-chromosome zoom is a
  whole-genome `CoreGetFeatures` against an all-vs-all track. Measure before picking a
  cap; copy the graph pattern (disabled item carrying the size in `disabledHelpText`). The
  repo prefers helpText over `disabled`; the graph plugin's counter-argument holds only
  where there is a hard cap.
- **`connectedViewId` for synteny**, so a launched stack can highlight back into its LGV.
- **The closed-track case.** The objection to session-wide discovery was the
  preselection, not the offer: an entry shown when no synteny track is open, with the
  dataset select empty and required, restores "browsing genes, want to compare". A product
  call.
- MAF rows as a pairwise synteny launch exist (`launchMafRowSynteny`;
  [MAF_CROSS_VIEW_NAVIGATION.md](MAF_CROSS_VIEW_NAVIGATION.md)).

## Gotchas

- **A CIGAR-less alignment is still clipped to the selection, by interpolation.**
  `resolveSpans` (`resolvePanel.ts`) walks the CIGAR when there is one and interpolates
  otherwise, which is the geometry the block is already *drawn* with. Framing on the whole
  block ignored the selection (one gene of a megabase asm5 block opened the megabase). Not
  an edge case: PAF without `-c`, MashMap, MCScan and the coarse PIF tier carry no `cg`.
- **A panel is every block its mate aligns the region with, not the widest.**
  `pickMatesForRegion` groups and `resolvePanel` unions spans: an HSP table or gene-anchor
  table is one row per hit, so dozens per locus; keeping the widest launched
  `ctgA:1,001..5,000` as `ctgA:3,001..5,000`. Three rules bound the union: the mate
  **contig** covering most of the region wins; the panel opens reversed only when the
  minus strand carries most of it; and `keepNearMedian` (shared with the multi-way lane
  frame) drops a hit further than 1.5 regions from the length-weighted median as repeat
  noise. The whole-block launch has no unit to scale by and keeps every hit.
- **Only coordinates cross the RPC.** `SyntenyDiscoverMates` returns `ResolvedPanel[]`
  (six numbers and two names per mate), since the CIGAR is unbounded (an asm5 `cg` tag runs
  to 100 KB) and a whole-chromosome launch against an HSP table is tens of thousands of
  blocks. The dialog preview and the launched view use the same numbers. **Round outward,
  in `resolvePanel` and nowhere else**: a span rounded in opens inside the row the user
  read.
- **A mate that is not a declared assembly is dropped from the launch, and the dialog has
  to say so.** `assemblyForPanSNName` falls back to the bare PanSN sample name, so an
  all-vs-all file yields mates the display draws and the launch cannot open.
  `pickMatesForRegion` returns `{ mates, unconfigured }`; saying "nothing aligns"
  contradicts the lanes the user sees. An *anchor* name not matching a PanSN prefix is an
  adapter error (`noPanSNMatchError`, `plugins/comparative-adapters/src/util.ts`), since
  both all-vs-all adapters answer `hasDataForRefName` with `true`. Check prefixes with
  `tabix -l <url> | cut -c2- | cut -d'#' -f1 | sort -u`.
- **A launch RPC that does not rename its region silently opens an empty view.** JBrowse
  maps a region's refName onto the adapter's names before `getFeatures`, but a plain
  `RpcMethodType` gets no mapping (`GetSubgraph` now extends
  `RpcMethodTypeWithRenameRegion`). Hosted GRCh38 FASTAs use bare `1`/`6` names while graph
  stable names are `GRCh38#0#chr6`, so it was the default human case. `renameRegionsIfNeeded`
  throws on the singular-region/plural-base-class near-miss, but a method extending plain
  `RpcMethodType` never calls it.
- **The graph adapters live in the plugin repo**, not here (`RgfaTabixAdapter`,
  `MinigraphBubbleAdapter`). A subgraph comes from an adapter declaring `getSubgraph`
  (`RgfaTabixAdapter`, `GbzBaseSyntenyAdapter`); `MinigraphBubbleAdapter` reads a summary
  index and cannot cut one. Minigraph-Cactus: `sv.gfa` is rGFA, plain `.gfa` is not;
  pggb/odgi needs `odgi extract`.
- **Menu rows have stable testids** from `makeTestId` (`CascadingMenu.tsx`):
  `cascading-submenu-<label>` / `cascading-menuitem-<label>`, lowercased with whitespace →
  `_`. Use them, not text: a track's name is usually also its view label and a text match
  resolves to that.
- **Launching by `session.addView` bypasses invariants.** Synteny routes through
  `launchSyntenyView` (`packages/synteny-core`), which owns the "≥2 views" check.
- **`getSession()` throws on a track *config* node.** Session-wide discovery hands back
  `AnyConfigurationModel`s outside the session tree; pass the session in. It fails as `no
  session model found!` rendered inside the dialog, looking like an empty result.

## Verifying a launcher

Unit tests cover the pure parts (`launchTargetsMenuItem`, `panelOrder`,
`pickMatesForRegion`, `resolvePanel`, `buildSyntenyViewSpec`). The jsdom test
`products/jbrowse-web/src/tests/LGVSynteny.test.tsx` drives `view.rubberBandMenuItems()`
through the real extension point and still missed that nothing *rendered*. Generating the
figure (`multiway_synteny/ecoli_launch_from_selection`; regen loop in
`website/scripts/screenshot-review-plan.md`) caught the rest. Pick the demo window with
care: a window inside the paa operon island (three of four strains unaligned) makes
discovery return one mate and degenerates to the pairwise case. Graph figure specs
(`website/scripts/specs/graph-ecoli.ts`) assert only a picture, so review by eye:

- **Pick the clicked feature from the index.** A segment with no rank>0 neighbour cuts a
  straight run of backbone. `tabix ecoli_minigraph.links.bed.gz K12#1#chr:4050000-4100000`
  names segments with alleles.
- **Target the rendered label, not a coordinate**:
  `[data-testid="feature-name-<label text>"]`
  (`plugins/canvas/src/LinearBasicDisplay/components/overlayElements.tsx`).
- **A graph canvas is too sparse for the content-stable diff gate** (mostly white, thin
  strokes: an anchored-to-force switch moved 2.7% of pixels and was kept). Regenerate a
  deliberate layout change with `--force`.

**Figures cover only what is published.** The tutorials load the plugin from the plugin
list's `latest/` url, a code-split bundle: grep the entry *and every chunk it references*
and diff the entry's md5 against the local `dist/`.
