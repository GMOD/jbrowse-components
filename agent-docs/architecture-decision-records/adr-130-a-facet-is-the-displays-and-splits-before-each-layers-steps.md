---
status: Accepted
summary: "The mark display's facet moves off `marks[].facet` onto the display as the flat `facetField`/`facetDomain` pair the feature display already had, with a display-level `transform` running before it. The worker splits the features by the facet key and runs each mark's own steps over each section alone, so a faceted display is the unfaceted one drawn once per section; the main thread caps over every region's keys, orders by the domain, and derives the drawn layers, the key and the value axis from the sections left visible, and `stack.groupby` goes"
---

# ADR-130: A facet is the display's, and splits before each layer's steps

## Status

Accepted (2026-09-18).

## Context

The mark display's facet sat on a mark (`marks[].facet: { field, domain }`)
and ran after that mark's steps, offsetting the rows a `stack` grouped by the
same field. A facet partitions a whole display, and the per-mark spelling
could not say that:

- The first mark declaring a facet set the chips, the order and the Sections
  menu, while every other mark's facet still reached the worker and its
  section table was folded in under the first mark's field.
- A mark with no facet kept rows of 0 and drew in the top row of the first
  section, at `1 / rowCount` of the plot.
- A step that made new features — `coverage`, an `aggregate` not grouped by
  the field — dropped the field, so its output filed under `field: none`.
- The partition had to be written twice. A facet without `stack.groupby` left
  sparse sections (four features over seven rows); a `stack.groupby` without a
  facet overlapped its groups on the same rows.
- The worker capped each region on its own, so a value could be its own
  section in one region and merged in another, and the values merged into the
  overflow section drew over each other on the rows their own stacks gave
  them.
- A hidden section's instances were parked on the row after the last band.
  The row height is `floor(plot / rowCount)`, which usually leaves that row
  inside the plot, so the hidden reads still drew; the key and the value axis
  kept them too.
- The domain crossed to the worker, so every Sections move refetched.

## Decision

**The facet is the display's two flat slots**, `facetField` and
`facetDomain`, spread from `facetConfigSchemaFields` into the feature and mark
displays alike. **A display-level `transform`** takes the same steps a mark
does and runs before the facet, where a field the facet reads is made.

**The worker splits before each mark's steps** (`facetLayers`): the display's
steps run, the features split on `categoricalField(field).key`, each mark's
steps run over each section alone, a section is as tall as the tallest mark
packed it, and each feature carries its stacked row in `FACET_ROW`. The
request carries `facet: { field }` and no domain.

**The main thread owns order, cap and visibility.** `facetLayout` caps over
every loaded region's keys in natural order, keeps each merged value's band
inside the overflow section, orders by the domain and drops the hidden
sections. `remapFacetRows` moves every region's rows onto that layout and
filters a hidden section's instances out of every lane, rebuilding the hit
index (`hitIndexOf`); the key and the extents are then read off what is
drawn.

## Consequences

- A faceted section is the unfaceted mark over that section's features,
  offset; `featureTransforms.test.ts` pins it, and a coverage mark counts each
  section's depth.
- `stack.groupby` is gone. A facet on a computed field puts the formula in the
  display's `transform`, or names the field as a `jexl:` expression.
- No migration from `marks[].facet`.
- A hide toggle filters each faceted layer and rebuilds its hit index, an
  O(n log n) pass per layer per region on a click.
- A glyph key over a different field than the colour's drops a value when its
  glyph is no longer drawn, which is exact only while no two values share a
  glyph; the colour key is keyed by the colour, as the feature display's is.

## Rejected alternatives

- **Keep the per-mark facet and fix the fold.** Two marks faceting two fields
  still have one chip row between them, and a mark without a facet still has
  no section to draw in.
- **Encode each section separately and join them in the worker.** Exact
  per-section tables, but a `span`'s colour ramp resolves in the worker, so
  each section would take its own ramp domain; one encode per mark keeps the
  region's.
- **Park hidden instances on a far row.** The hit index, the key and the axis
  would still see them.
- **Cap in the worker, domain first.** It puts the domain in the fetch key,
  and a region's cap disagrees with its neighbour's.
