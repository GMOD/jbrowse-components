---
name: a-legendconfigschemafields-helper
description: A `legendConfigSchemaFields` helper
area: config-and-mst
---

# A `legendConfigSchemaFields` helper

, sharing the `showLegend` config slot
the way `treeSidebarConfigSchemaFields` shares the tree ones — priced
2026-08-17 and declined. The *accessors* did move that day: `LegendMixin` owns
`showLegend` / `showLegendDisplayTypeDefault` / `setShowLegend`, which were
character-identical in six displays (`LinearAlignmentsDisplay`,
`LinearHicDisplay`, `LinearMultiRowFeatureDisplay`,
`MultiLinearWiggleDisplay`, `MultiSampleVariantBaseModel`, `SharedLDModel`),
and both ends of that were already shared — every one of the six builds its
row with `showLegendCheckboxItem` and shows a `FloatingLegend`, so the triple
was the middle link between two pieces of common code.

**The slots are the half that genuinely differs, and it was checked rather
than assumed**: `promotedBase` really does split three/three, each description
names a different legend, and the "falling back to off/on" tail every
description carries agrees with its own `promotedBase` in all six. A helper
would therefore be parameterized on everything that varies and share one
`type: 'maybeBoolean'` line. `showLegendCheckboxItem`'s docstring had already
decided this and the mixin does not disturb it; re-proposing needs a reason
better than symmetry with `treeSidebarConfigSchemaFields`, which exists
because that set had actually drifted.

The coverage lesson generalizes and is the reason to move accessors at all: a
wrong `showLegend` was visible to two of the six displays. Hi-C, multi-row,
multi-wiggle and LD had no test that would notice, so inverting the getter
left all four green. One implementation collapses that to one place, and
`LegendMixin.test.ts` runs the whole promotable cascade over both
`promotedBase` values.
