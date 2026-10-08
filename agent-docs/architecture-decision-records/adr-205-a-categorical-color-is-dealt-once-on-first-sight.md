---
status: Accepted
summary: "A value a categorical color's `domain` does not list is dealt a palette slot once, on first sight, and keeps it: its hashed slot unless a value met before holds it or a near twin, else another slot derived from itself, recorded in a caller-owned `HeldSlots` map (`categoricalScale`'s `held`). protein_coding, snRNA and TEC no longer share #e41a1c, a value nothing collides with keeps exactly its hashed color, and a color once shown never changes while the track is open. `heldColorSlots` keeps one map per field, domain and range under the session, shared by every track coloring by that field, so a gene symbol paints one color down every panel and a color edit deals afresh; nothing is persisted. Each reader deals a region's values in `field.compare` order (`dealKeyColors`) before painting. Synteny deals a text column's labels in the order the view first saw them (`CategoricalMode.seen`). Every color \"Pin distinct colors\" item and its model members go; shapes keep theirs. Not ADR-160's row dealer. Amends ADR-131, ADR-136 and ADR-156"
---

# ADR-205: A categorical color is dealt once, on first sight

## Status

Accepted (2026-10-03). Amends
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md),
[ADR-136](adr-136-a-legend-follows-its-scale-and-a-color-slot-is-a-color.md)
and [ADR-156](adr-156-the-feature-color-takes-a-threshold.md) where they
describe "Pin distinct colors".

## Context

With no `domain`, `categoricalScale` painted a value
`palette[hash(value) % 40]`, each value on its own: `protein_coding`, `snRNA`
and `TEC` all painted `#e41a1c`. The birthday bound on 40 slots gives two
values one color 71% of the time at 10 values and 95% at 15. The workaround
was a menu item on five displays that wrote every keyed value into `domain`,
which a user had to find, and which froze an order the data then outgrew.

A hash was chosen because a value's color then depends only on the value: a
discovery-order slot let one region paint `chr2` blue and the next pink. That
property only matters for a value already shown. What a reader needs is that a
color, once on screen, does not move.

## Decision

- **A new value takes its hashed slot if it is free, else `freeSlot`.** A slot
  is taken when a listed value or a held value holds it, or one `isNear` calls
  the same (`similarColors`). The slot is recorded in `held` and never dealt
  again. Past the palette's length, the hash. With no `domain`, the deal spends
  `range` first and spills into the `fallback` entries it lacks. Without
  `held`, the rule is exactly the old one, so the jexl `categoricalColor`, the
  worker and every caller that passes nothing are unchanged.
- **The caller owns `held`.** `heldSlotsOf(owner, key)` keeps one per owner and
  key in a `WeakMap`; `heldColorSlots(node, encoding)` (display-kit) keys it by
  field, `domain` and `range` under the session, with no track in the key. Every
  track coloring by one field deals into the same map, as the hash agreed
  across tracks before: three strains' gene tracks colored by `gene` paint a
  shared symbol one color down all three panels, collided or not. Two views of
  a track, or a hide and show, deal into it too. A color object that changes
  any of the three is a new key and deals afresh. Nothing is persisted. Keying
  by track as well was tried first and dropped: a collided symbol could then
  take a different color in each panel, which the synteny tutorial's ortholog
  figure promises against.
- **The map is a write-once memo, not MobX state.** A held slot never changes,
  so a color read inside a computed stays true, and the field palette and the
  encode memo keep their identity as values arrive: a new value is one new
  cache entry, not a re-encode of every region. Dealing at the color's first
  read, rather than from an action at region commit, also covers a color edit
  that refetches nothing, which no commit sees.
- **Each reader deals a region's values in `field.compare` order first**
  (`dealKeyColors`): the canvas field palette and both canvas legends, the mark
  display's `colorByKeys`, the multi-sample variant cells. The multi-way
  display's gene colors deal in feature order, which its key reads after. So a
  single-region view, which every figure is, is deterministic whichever reader
  runs first.
- **Synteny deals its labels in first-seen order.** `TrackColorsMixin` already
  kept a grow-only label list; `orderAttributeLabels` keeps that order as
  `seen` beside the domain-sorted `labels`, and `categoricalColor(mode, label)`
  deals `seen` in order, cached per list. The view needs no held map.
- **Every color pin goes.** The canvas, multi-row and variant displays'
  "Pin distinct colors" (`pinnedColorDomain`, `pinColorDomain`); the multi-way
  gene pin (`pinnedGeneColorDomain`, `pinGeneColorDomain`, `geneColorScale`,
  `geneColorDomain`); the synteny text-column pin and the menu target's
  `colorDomain`/`setColorDomain`; the mark display's color pin and its color
  collision notice; display-kit's `ColorByBlock.pin`.
- **Shapes keep their pin.** The mark display's shape resolves in the worker
  and has three glyphs; "Pin distinct shapes" (`pinDistinctShapes`) and its
  notice stay until a `shapeKey` lane, as ADR-202's `colorKey`, brings it to
  the main thread.

## Consequences

- **Tracks sharing a field share its 30 colors.** Unrelated tracks that happen
  to color by one field name (`type` on a gene track and a repeat track) draw
  from one deal, so a value paints one color on both and the two together run
  out of distinct colors sooner.
- **A collided pair's colors follow the order the session first met them.**
  Reloading a session at the same locus reproduces them; a share link landing
  elsewhere may swap a collided pair. A value nothing collides with paints its
  hashed color everywhere.
- Within one multi-region view, the deal follows the order regions arrive in,
  which is the fetches' order.
- The 40-entry palette has 30 distinct colors once near twins are stepped
  over, so a track past 30 values starts sharing again, then hashes.
- Multi-row hide-by-color keys on the packed color, which no longer moves,
  so a hidden category stays hidden as regions arrive.
- Alignments tag colors keep their own hash copy (`bakedColorScale`) and are
  not dealt.

## Rejected alternatives

- **Deal from an action at each display's region commit.** Planned first. A
  color edit that changes `domain` or `range` refetches nothing on the canvas
  and mark displays, so loaded values would reach a fresh map through reads
  anyway, and five commit hooks would carry the same call.
- **Hold slots in observable session state.** Nothing needs to react to a slot
  being recorded: it is written before anything paints the value and never
  changes after, while an observable map would hand the field palette a new
  identity on every arrival and re-encode every region.
- **ADR-160's row dealer.** `dealRowColors` deals rows by position with one
  cursor and no hash, which suits a row axis a reader arranges. A feature
  color has no position to deal by, and a value that never collides should
  keep the color it has always had.
