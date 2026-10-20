---
status: Accepted
summary: "Every display whose menus pick a facet composes display-kit's `FacetWritesMixin`, whose `facetByField(field)` (`''` ungroups) and `setFacetDomain(domain)` rewrite the `facet` object as written through `facetForField`: the field already grouping keeps its order and hidden sections, a new one starts with none, and members about something else, the mark display's per-section `transform`, stay. The per-display `setFacet` actions (four signatures) and the mark display's `setFacetField` go. The scroll reset a facet change triggers runs from `HiddenGroupsMixin`'s `dropGroupState`, so a facet written by `applyPlot`, an agent or a share link resets it too, and the SV-channels preset is one `applyPlot`. Color by's Default and Solid color... move onto `ColorWritesMixin` in the same pass"
---

# ADR-237: A facet takes two writes

## Status

Accepted (2026-10-20). The facet counterpart of
[ADR-223](adr-223-a-color-object-takes-two-writes-and-applyplot.md), from the
2026-10-20 grammar write-API audit and its design review.

## Context

The facet had one shape and four setters: the feature display's
`setFacet(facet?)` carrying `hidden` through `facetOf`, the multi-row
display's `setFacet(facet?)`, the multi-sample variant display's
`setFacet(field)` with `''` for none, and the alignments display's
`setFacet(facet?)` re-reading `facet.hidden` by hand. The mark display had
`setFacetField` and `setFacetDomain`, writing members one by one into an
object declared `writes: 'whole'`. Five section-order adapters each rebuilt a
`{ field, domain }` to reorder.

Two setters also reset the scroll, so a facet written through `applyPlot`, a
share link or an agent left the stack where it was, and the SV-channels
preset made two writes so the facet would go through its setter.

The same audit found five copies of Color by's Default and Solid color...
picks, whose tests for "a field paints" had drifted four ways.

## Decision

- **`FacetWritesMixin`** gives the feature, multi-row, multi-sample variant,
  alignments (and LGV synteny through it) and mark displays
  `facetByField(field)` and `setFacetDomain(domain)`, each over the object as
  written (`writtenFacet`), writing nothing where the pick already holds.
- **`facetForField(current, field)`** is the rule: the field already grouping
  keeps everything, another drops `domain` and `hidden`, and `''` drops the
  field too. A dialog building a draft (the feature display's Group by,
  the SV-channels preset) uses it and writes `applyPlot`.
- **A side effect of a facet change runs off the grouping.** The feature
  and alignments displays reset their scroll in `dropGroupState`, which
  `HiddenGroupsMixin` calls when `groupKeySpace` moves.
- **`ColorWritesMixin` holds `pickDefaultColor` and `pickSolidColor`**; a
  display supplies `openSolidColorDialog`.

## Consequences

- Removed model actions: every display's `setFacet`, the mark display's
  `setFacetField`, the canvas display's `openSetColorDialog` (now
  `openSolidColorDialog`) and the multi-way display's
  `pickDefaultGeneColor`/`pickGeneSolidColor` (now the mixin's). A script
  calling them fails as `is not a function`.
- A section reorder no longer resets the feature display's scroll; only a
  change of grouping does.
- The multi-sample variant display no longer warns from a menu pick about a
  facet attribute no sample carries; the menu offers only attributes samples
  carry, and the warning on load stays.

## Rejected alternatives

- **The writes on `HiddenGroupsMixin`.** The multi-sample variant and
  multi-row displays' facet has no `hidden` and composes no hidden-sections
  state.
- **Keeping `setFacet` with one signature.** It would take the whole object
  and so need each caller to carry the order and hidden sections, the work
  `facetForField` does once.
