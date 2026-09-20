---
status: Accepted
summary: "The alignments displays' `colorBy: { type, tag, modifications }` mode slot is `color`, the display-kit colour object `\"steelblue\" | { value, field, scale, domain, palette, ramp }`, with `scale` drawn from `none | categorical | linear | threshold`. A read dimension is a field under the facet's own name (`strand`, `firstOfPairStrand`, `pairOrientation`, `mapq`) beside the colour-only presets (`insertSize`, `insertSizeAndOrientation`, `mateRefName`), a per-base variable paints a cell per base (`baseQuality`, `base`, `modifications`, `bisulfite`), `tags.XX` reads a SAM tag and any other name a feature attribute. A declared scale evaluates in the per-read bake, so it recolours with no refetch and no relayout, and the GPU path is unchanged. The modification settings are their own `modifications` slot. The scheme name stays the runtime form. Supersedes ADR-131's \"alignments' `colorBy` selects a scheme and is outside this decision\""
---

# ADR-148: The alignments read fill is the colour object

## Status

Accepted (2026-09-20). Supersedes one consequence of
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md) ("like
alignments' `colorBy` it selects a scheme and is outside this decision").
Extends
[ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md)
to the last display holding a mode vocabulary in a `frozen` slot.

## Context

The alignments displays spoke two vocabularies over one set of variables. The
facet named a read dimension as a field, `facet: { field: 'pairOrientation' }`
or `'tags.HP'`
([ADR-131](adr-131-a-categorical-channel-is-one-config-object.md)), and the
colour named the same variable as a mode, `colorBy: { type: 'pairOrientation' }`
or `{ type: 'tag', tag: 'HP' }`. The slot was `frozen`, so the JSON schema and
`jbrowse validate` saw nothing inside it, and no scale was declarable: a tag's
colours were a function of its values, a numeric tag painted one colour per
distinct number, and the insert-size cut points came off the sampled
distribution alone.

A table of channel, variable and scale per scheme found the painter already in
the grammar's shape. `readColorCategory` derives one categorical variable per
read, the GPU indexes a uniform table by its level (`u.readCategoryColor`), the
Canvas2D painter indexes the same table, and the key scans the levels that
occurred. GenomeSpy resolves a categorical colour the same way, an index into a
range texture. `insertSizeAndOrientation` is one derived variable with a
precedence among its levels, a `case_when` before the plot, and the mate and
split overrides are further levels of it. What was missing was the declaration.

The tag and mate-reference schemes already resolve a colour per read on the main
thread after layout (`overlayReadTagColors`), a tier that reruns on a colour
change and touches neither the fetch nor the layout.

## Decision

**`color` is the display-kit colour object** (`AlignmentsColor`,
`alignmentsColorConfigSchema.ts`): `value`, and `field`, `scale`, `domain` from
`colorChannelSlots` with `colorPaletteSlot` and `colorRampSlot`, `closed`, a
string lifting into `value`.

**A preset is a field, and a read dimension takes the facet's name.**
`COLOR_FIELDS` (`shared/alignmentsColor.ts`) is the table, and
`alignmentsColor.test.ts` pins the four shared names against
`GROUP_BY_LABELS`. `tags.XX` is the facet's tag spelling. Any other name reads
`feature.get(name)` through the tag scheme's per-read value lane, so a PAF
block's column colours the way a tag does.

**A per-base variable is a field too.** `baseQuality`, `base`, `modifications`
and `bisulfite` vary per base, so the display paints them as a cell per base
over a plain read. The reader names a variable and the display picks the mark
from its grain, which is ADR-095's position that "the reader never picks a
mark".

**The scheme name is the runtime form.** `colorByOf` maps the object onto the
`ColorBy` the worker request, the classifier, the shader dispatch and the menus
already read, as `ribbonColorBy.ts` does for the multi-way display, and
`setColorBy` writes the object back through `colorSnapshotFor`: the plain fill
keeps the field under `none`, a re-picked field keeps its order, palette and
ramp, and a re-pick of the scheme in use writes nothing, since every colour tier
keys on the slot's arrays.

**A declared scale evaluates in the bake.** `bakedColorScale` builds one scale
from the object and the bake and the key both read it: a `domain` or `palette`
hands the listed values their colours over the tag palette, `linear` runs a
ramp over a pinned `domain` or the span of the loaded reads
([ADR-124](adr-124-the-score-axis-autoscales-over-what-is-loaded.md)),
`threshold` paints the bin a value falls in. The result is the packed colour per
read the shader already takes, so no shader, instance layout or per-frame path
changed. `model.coupling.test.ts` pins that a palette change leaves `rpcProps()`
and the layout arrays alone.

**`insertSize`'s `domain` pins the two cut points**, replacing the region's
sampled band where the fetched data enters the model (`buildRawDataByGroup`).
The read fills, the arcs and the hover each take the band off the region's data,
so one replacement keeps the three on one threshold
([ALIGNMENTS_COLOR_PARITY.md](../reference/ALIGNMENTS_COLOR_PARITY.md)). A pin
costs a relayout when it changes, which a config-time declaration can afford.

**`value` is the plain read fill**, written over the palette's neutral entry, so
the GPU table, the Canvas2D painter, the key and the arcs of that meaning follow
one value.

**`modifications` is its own slot**, holding what `colorBy.modifications` held.
It stays `frozen`: `shownModifications` tells an absent list from an empty one,
which no array slot type says.

**A v4 `colorBy` migrates**, in the session migration and on a config display
node alike (`colorSlotsOf`, `sessionMigrations/index.ts`), which is where the
retired `methylation`, `stranded` and `insertSizeGradient` names now resolve.

## Consequences

- A config or session writing `colorBy` on an alignments display that skips the
  migration paints the plain fill.
- `displayDefaults: { color: { field: 'strand' } }` on an `AlignmentsTrack`
  routes to the alignments display and the mark display, which take one shape
  ([ADR-134](adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)).
- An unpinned linear ramp rebakes every loaded region when a new region widens
  the span. The bake is one pass per read with the colour cached per distinct
  value.
- A `palette` beside a preset field with a vocabulary of its own (`strand`,
  `pairOrientation`) waits unread: several levels share the palette's neutral
  entry and the arcs derive their colours from the same table, so a per-level
  override is a change to that table and not to the bake.

## Rejected alternatives

- **Splitting the per-base layers from the read fill**, a `color` for the read
  and a layer switch for quality, letters and modifications, so a read coloured
  by `tags.HP` could carry methylation marks. It is the grammar's layer stage
  and the one combination users ask for, and it changes what every "Color by"
  radio means. One object with one field keeps today's menu and leaves the split
  open as a per-mark `encoding`.
- **Moving the mismatch and modification painters onto the encoder.** Both are
  already a key into a colour table with an opacity from a second lane
  (`Paint.palette` over the base byte with the quality fade; the modification's
  type index and probability byte ship beside its packed colour), and
  [ADR-118](adr-118-the-packers-share-a-rule-not-a-step.md) priced the
  `Feature[]` a step would read at 4.23x the hand path.
- **An insert-size gradient under `scale: 'linear'`.** Retired once as
  `insertSizeGradient`; `pinnedInsertSizeBand` holds the reason.
