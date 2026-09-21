---
status: Accepted
summary: "The wiggle family's `global` and `globalsd` autoscale modes were retired on 2026-06-19 and this records it: they scoped their statistics to the loaded regions, not the file, so they barely differed from `local` and `localsd`, and the domain has since been derived on the main thread from the rendered arrays with no stats round trip left to scope. An old config's `global` remaps to `local` in `preProcessSnapshot`. A domain that grows as the user pans is the design, not a seam, and an axis a figure needs still is pinned: the Score menu's \"Pin current min/max\" copies the drawn domain into the slots, and the mark display's onto `encoding.y.domain`"
---

# ADR-124: The score axis autoscales over what is loaded

## Status

Amended by [ADR-141](adr-141-one-y-scale-the-displays.md): the mark display's
pin lands on `scales.y`, not on the owning mark's `encoding.y.domain`.

Accepted (2026-09-16), recording a retirement made on 2026-06-19 in
c7ee0eadd1 that no document described. Closes the last two items of the
2026-09-15 grammar handoff.

## Context

The wiggle family once offered five autoscale modes: `local`, `localsd`,
`localpercentile`, `global` and `globalsd`. The two global modes asked the
adapter for `getMultiRegionQuantitativeStats` over the loaded regions and
scaled the axis to that. They never read the file: on a BigWig the header's
total summary was there to be read and was not, and on a bedGraph a whole-file
scan was the only way. So "global" meant the union of what was loaded, which
is what `local` means once the local modes moved to the main thread and read
their extremes off the rendered arrays (`visibleStatsDomain`). Two modes that
barely differed from two others, behind a radio.

The retirement dropped the two modes from `DEFAULT_AUTOSCALE_OPTIONS`,
narrowed the `autoscale` enum, and installed `remapRetiredAutoscale` as a
`preProcessSnapshot` on the wiggle and gwas config schemas, mapping `global`
onto `local` and `globalsd` onto `localsd` so an old config still loads. It
left `getRegionQuantitativeStats` and `getMultiRegionQuantitativeStats` on
`BaseFeatureDataAdapter`, overridden on `BigWigAdapter` and
`MultiWiggleAdapter`, with a comment saying they are unused in-tree and kept
for an external plugin.

What was missing was the decision. `reference/GRAMMAR_OF_GRAPHICS.md` says of
the ramp domain that "a value in no loaded region has never been seen, so the
domain still grows as the user pans", which reads as an unfinished edge, and
a reader reaching for the adapter's stats methods would find them tested and
waiting.

## Decision

**The axis autoscales over the loaded regions, and that is the whole design.**
No mode reads the file. The domain is the extremes of what is drawn, widened
to the origin and to the reference lines each display declares, and it moves as
the loaded set moves. A value nobody has loaded has
no claim on the axis.

**A figure that needs a still axis pins it, and the menu does the pinning.**
`makeScoreSubMenu` offers "Pin current min/max" while the display's `domain`
is known. It copies the drawn domain into `setMinScore`/`setMaxScore`: on the
wiggle displays and manhattan that is the `minScore`/`maxScore` slots, on the
mark display `setDeclaredBound` lands it on `encoding.y.domain`, because the
declaration owns that display's value scale. "Clear manual min/max" reopens
both ends.
The drawn `domain` is the pair to copy and the resolved `minScoreBound`/
`maxScoreBound` pair is not: on an autoscaled track both are `undefined`, and
copying them pins nothing.

**The adapter stats methods stay, as adapter surface.** They are part of what
an external plugin can call and they are tested. Nothing in the tree should
grow a consumer for them in the name of a global axis.

## Consequences

- `scoreMenuItems.test.ts` pins the row's presence on a known domain, its
  absence before one resolves, and that a click writes the domain and not the
  bounds. `model.test.ts` pins that the mark display's pin lands on the
  declaration with the score slots untouched.
- A display that names its drawn range something else answers no `domain` and
  gets no pin: the alignments coverage band's is `coverageDomain`, because a
  bare `domain` on a display with a pileup, a coverage band and arcs would
  not say which.
- A display overriding `defaultScoreDomain`, GC content's `[0, 1]`, pins to
  the same pair it already drew; the resulting "Clear manual min/max" row is
  truthful there, the user having pinned.
- `GRAMMAR_OF_GRAPHICS.md`'s seam sentence points here, so the next reader
  proposing a global-stats round trip finds the decision before the code.

## Rejected alternatives

- **A file-wide mode read from the BigWig header's total summary.** Real
  global, and cheap for that one format. It answers nothing for a bedGraph or
  a MultiWiggle of mixed files, and a mode that means "the file" on one
  adapter and "what is loaded" on another is the confusion the retirement
  removed.
- **Pinning through the resolved bounds.** The member names invite it, and
  on every autoscaled track it writes `undefined` twice.
- **A `frozen` snapshot of the domain in the session, outside the config.**
  A second home for the same fact as `minScore`/`maxScore`, invisible to the
  config editor and to the export, which reads the slots.
