---
name: one-display-pick-for-every-track-route
description: A track's `displays` list both configures displays and picks the one a view opens, and a config.json track and a session track build that list differently, so one track can open two ways and tests (session route) miss what the catalog does. Colin's calls of 2026-09-27 - declared displays are settings, never a cross-view pick; both routes pick from one candidate list. Half a day to a day. Open behind it - a way to write one setting for several display types.
---

# One display pick for every track route

## The problem

A track config's `displays` list does two jobs. Each entry carries settings for
one display type, and the list's order is the default a view opens the track
with. An admin who writes `marks` for a BEDPE track's `LinearMarkDisplay` only
meant to style the linear view, but until 2026-09-27 that entry also made the
circular view open the track as a ring of those links instead of chords.

The two routes a track arrives by also build different lists. A config.json
track is `types.frozen` raw JSON (`packages/app-core/src/JBrowseConfig/index.ts`),
so `resolveTrackDisplayChoice` (`packages/core/src/util/tracks.ts`) sees only
the displays it declared, and `pickDisplayForView` falls back to the track
type's whole list with no adapter-capability filter. A track built as a config
node (a session track, `addTrackConf`, every test harness) runs
`preprocessTrackConfigSnapshot` (`baseTrackConfig.ts`), which appends a stub
for each display the track type offers and the adapter can feed, and it is also
where `displayDefaults` expands, so the catalog route's pick never sees that
shorthand. The circle bug
passed every suite because the tests took the node route; `ringTypes.test.ts`'s
catalog case (`fromCatalog`) is the one that reproduces it.

Commit `71dccb94c2` fixed the visible case by reordering `pickDisplayForView`:
declared-and-the-view's-own, then the view's own, then declared, then any.
That rule is right and stated nowhere as a rule.

## Colin's calls (2026-09-27)

- **A declared display is settings.** Writing settings for one display type
  never changes which display another view opens. Within one view, the listed
  order still chooses between two displays that view draws natively
  (alignments vs marks on the linear view).
- **Both routes open a track the same way.** They build one candidate list
  before picking.
- **SNPs need nothing on the circle.** A VariantTrack opens as chords; a record
  with one locus draws no chord, and the SV kinds (breakends, DEL, INV, DUP,
  CNV, TRA) draw between their two loci (`svKinds.test.ts`).

## The work

1. One function builds a track's candidate displays from a snapshot: declared
   entries, then the track type's displays its adapter can feed. The catalog
   route and `preprocessTrackConfigSnapshot` both call it.
2. `pickDisplayForView` picks from that list by the rule above, written as the
   rule in its docstring and ADR-119.
3. The pick tests run each case through both routes.

## Open behind it

Colin, 2026-09-27: "we may want to brainstorm a generalizable way to help
express changes across display types. the displaydefaults is one option...kind
of a hazy one because it sort of assumes that you are just trying to customize
the linear primarily". Once declared entries are settings only, a setting meant
for every display a track opens with (a colour, a label field) has no single
place to go. `displayDefaults` routes shorthand keys to whichever displays
accept them (`expandTrackConfigShorthand`), which is the nearest thing today.
Not decided; bring options to Colin before building.
