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
   `menuItems()` (visible region) and/or `rubberBandMenuItems()` (selection) on
   `LinearGenomeView`; override `trackMenuItems()`/`contextMenuItems()` on a
   `DisplayType` when the entry point belongs to one track.
2. **Discover session-wide, not view-wide.** Scan `session.tracks` (via
   `allSessionTracks`, so connection tracks count) for tracks that can serve the
   region. The graph plugin's comment is the rationale: *"The graph track need
   not be in the view, or even turned on… before, the only entry point was the
   menu of a track they might never have opened."* This is why a
   display-contributed `regionLaunchItems()` seam was considered and rejected —
   it cannot serve a track with no display.
3. **Discover by declared capability, not adapter name.** The graph plugin
   checks `pluginManager.getAdapterType(t).adapterCapabilities.includes('getSubgraph')`
   (`RgfaTabixAdapter/index.ts:17` declares it). It hardcoded
   `GfaTabixAdapter`/`GfaServerAdapter` once and *"that is exactly what left it
   dead when those were removed."* Registration is checked first, because a
   session can hold tracks whose plugin isn't loaded and `getAdapterType`
   throws on an unregistered type.
4. **Collapse the offer by count.** 0 capable tracks → no menu item at all;
   1 → a flat item; N → a submenu naming each. In this repo that rule is
   `LaunchSyntenyView/oneOrManyMenuItem.ts` (tested); in the graph plugin it is
   inline in `subgraphMenuItems.ts`.
5. **Group with `pushLaunchViewMenuItem`** (`@jbrowse/core/ui`) in long menus
   (view menu, track menu) so offers collect under one "Launch view" submenu.
   Rubberband items go in **flat** — that menu is short and contextual.

## Where they diverge

| | graph | synteny |
|---|---|---|
| dialog | none — menu click launches | yes — panel picker + window size |
| what persists | `loadedTrackId` + `loadedRegion` view props | resolved locstrings in `init` |
| size guard | `MAX_GRAPH_REGION_BP = 100_000`, disabled item + `disabledHelpText` | none |
| source linkage | `connectedViewId` → hover sync | none |
| entry points | view menu, rubberband, track menu, feature context menu | view menu, rubberband, alignment context menu (pairwise) |

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

**Pair the two launches on one selection.** An all-vs-all PAF and a pangenome
graph are two representations of the same alignment; the docs already pair them
by hand (`website/scripts/specs/pangenome.ts` → `pangenome/local_subgraph`,
`pangenome/rgfa_subgraph_launch`). One rubberband could offer both. The blocker
is data, not code: the hosted `jbrowse.org/demos/ecoli_pangenome/config.json`
carries `ecoli_ava` (PAF) but **no rGFA track**, while
`ecoli_minigraph{,.tbi}` sits at that same demo path and the gallery item
injects it as a `sessionTracks` entry. Adding it to the hosted config makes both
offers appear in one session. That config is hand-uploaded and never
regenerated — audit by `curl`-ing it, don't assume the repo matches.

**Lift `oneOrManyMenuItem` into `@jbrowse/core/ui`** beside
`pushLaunchViewMenuItem`, and drop the graph plugin's inline copy. Cross-repo,
so it lands behind a version bump — see `reference/PLUGIN_ABI_STABILITY.md`.
Not worth doing for two callers alone; worth it the moment a third launcher
appears, which is also when the N-plugins-each-overriding-`rubberBandMenuItems`
shape starts to hurt and an actual `LaunchViewForRegion` extension point
(plugins contribute offers, the LGV collects once) earns an ADR.

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
graph track's own menu; synteny has no track-menu equivalent.

## Gotchas

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

Unit tests cover the pure parts (`oneOrManyMenuItem`, `panelOrder`,
`pickMatesForRegion`, `buildSyntenyViewSpec`). They are not enough — the jsdom
integration test in `products/jbrowse-web/src/tests/LGVSynteny.test.tsx`
("launch a multi-panel synteny view from a region selection") drives
`view.rubberBandMenuItems()` through the real extension point and asserts the
launched view's assemblies, and it still missed that nothing *rendered*.

What caught the remaining bugs was generating the figure
(`multiway_synteny/ecoli_launch_from_selection`, a `stages` spec; see
`SCREENSHOT_REVIEW_HANDOFF.md` for the regen loop). Pick the demo window with
care: the first render landed inside the paa operon island, the one locus where
three of four strains have no alignment at all, so discovery correctly returned
a single mate and the multi-panel launch degenerated to the pairwise case it was
meant to contrast against.
