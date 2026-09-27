---
name: chord-variant-colour-is-the-shared-colour-object
description: ChordVariantDisplay keeps the tree's last plain `color` slot, so `displayDefaults: { color: { field } }` colours a variant track's linear displays and skips its chords. About a day, blocked on one call - a VCF feature carries no `svType` or `impact` (the variant displays paint those presets through jexl), so a chord coloured `{ field: 'svType' }` reads nothing.
---

# The chord variant colour is the shared colour object

## Where it stands

Colin asked on 2026-09-27 for "a generalizable way to help express changes
across display types", worried that `displayDefaults` "sort of assumes that you
are just trying to customize the linear primarily". `displayDefaults` already
behaves like ggplot's plot-level `aes()`: a key reaches every display of the
track whose slot takes it, a display without the slot skips it, and a key no
display takes fails the load (ADR-134). Since 2026-09-27 it merges into the
displays a track has and adds none, and a track opens only as a display its
adapter feeds (`displayCandidates`, `packages/core/src/pluggableElementTypes/models/baseTrackConfig.ts`).

What reads linear-first is the vocabulary. `ChordVariantDisplay`'s `color` is a
plain `color` slot, the only one left since ADR-135 gave the other displays one
colour object, so `displayDefaults: { color: { field: 'type' } }` colours a
VariantTrack's linear displays and skips its chords.

## The work, about a day

1. `ChordVariantDisplay.color` becomes the shared colour object, with the link
   mark's scale set (ADR-177: an encoding written for one reads for the other).
   Each chord's colour comes through `categoricalField` where
   `stateModelFactory.ts:172` reads the slot today, and the key through the
   `legendSpec` sections the circle's legend already takes
   (`CircularView/circularLegend.ts`). `legendColor` (`stateModelFactory.ts:416`)
   reads the constant out of the object. The `strokeColor` retired lift stays.
   `TrackConfigShorthand.test.ts` asserts a bare string and moves.
2. **The call that blocks it.** A VCF record carries no `svType` or `impact`;
   the single-variant display paints those presets through a jexl function
   (`plugins/variants/src/LinearVariantDisplay/presetColor.ts`), and they live
   in `plugin-variants`, which `circular-view` does not depend on. A chord
   coloured `{ field: 'svType' }` would read nothing and paint every chord the
   no-value grey; `{ field: 'type' }` works as it is. Either VCF features carry
   `svType` and `impact` as fields with one vocabulary each, or the chords reach
   the presets. The first also ends the two SV palettes: fixed class colours on
   the single-variant display, set1 dealt by hash on the multi-sample one
   (`plugins/variants/src/shared/variantSvType.ts`).
