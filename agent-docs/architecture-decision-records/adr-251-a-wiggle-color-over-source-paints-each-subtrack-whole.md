---
status: Accepted
summary: "The wiggle display's `encoding.color` takes a `field`, `score` or `source`. `source` paints each subtrack its resolved row color (`rowColor`, then the file's `color`, then the palette over a shared plot) on both sides of the `origin`, and reads no `scale`; a subtrack with no color paints the score's pair. A color writing nothing colors by `source` on bars, points and lines and ramps the score on a heatmap, so a lone BigWig keeps its pair. The split default goes: a row per subtrack no longer paints its row color above the cut and the shared negative color below it, since the y position already shows the sign. `perSource` leaves gpuProps. ADR-207's deleted `source` switch returns as a field of the one color object. A heatmap's color domain stays on `encoding.y.scale`, left for a call"
---

# ADR-251: A wiggle color over source paints each subtrack whole

## Status

Accepted (2026-10-27), Colin's "go for it" after a design review of the
wiggle display against the grammar of graphics. The heatmap's domain, the
review's second color finding, is open below.

## Context

- The mark display writes "color by subtrack" as `encoding.color: { field:
  'source' }`. The wiggle display could not write it: `WiggleColor` had no
  `field`, and the subtracks painted their row colors by an implicit rule
  (`rowColorPaintsMarks`: no written color and no gradient).
- Under that rule, a row per subtrack painted its row color above the cut
  and the shared negative color below it. GRAMMAR_OF_GRAPHICS.md listed the
  split as "one channel carries two variables", and ADR-227's 2026-10-20
  amendment named it the last color reason the plots stay off render-core's
  one-field color.
- ADR-207 had deleted a `color: { field: 'source' }` switch. ADR-164 records
  why: a color per subtrack then took two settings, `rowColor` naming each row
  and the switch, and the dialog wrote only the first. ADR-241 says a written
  `field` always paints, and ADR-207 rules only the default.

## Decision

- **`encoding.color.field` is `score` or `source`.** `score` is the plotted
  value, through `scale`, whatever field `y` names; `source` is the subtrack.
- **`source` reads its colors from the rows.** Each subtrack paints its
  resolved row color, `rowColor` then the file's `color` then the palette over
  a shared plot, and the channel's own `value` and `scale` paint nothing,
  which the corner says. One object, `rowColor`, maps subtracks to colors;
  ADR-164's trap needed a second.
- **A subtrack's color paints both sides of the `origin`.** The y position
  already shows the sign. A subtrack with no color paints the score's pair, so
  a lone BigWig draws as it did.
- **A color writing nothing colors by `source` on bars, points and lines,**
  the rule `rowColorPaintsMarks` stated before, now named as a field; a
  heatmap writing nothing ramps the score. A written scale with no field maps
  `score`, the schema's `impliedField`.
- **A heatmap over a written `source`** paints each subtrack one flat color,
  and the display's corner notice says the score goes unencoded.
- `wiggleColorsBySource` is the one rule; the model, `wiggleTables` and the
  plot color line read it. `perSource` leaves gpuProps, since a source's own
  color decides its two sides.

## Consequences

- The display now draws a stacked multi-wiggle whose subtracks carry colors
  and signed scores in one color per row. The in-tree multi-wiggles with declared colors
  plot non-negative scores, so their pictures hold; jb2hubs' hosted composites
  were not checked.
- `{ field: 'score' }` keeps the pair beside colored subtracks, which before
  took a written range.
- The arrangement dialog hides its two plot swatches under a written
  `source`, since a pair written over it would drop the field.
- GRAMMAR_OF_GRAPHICS.md drops its "one channel carries two variables" gap,
  and ADR-227 its last color reason.
- The mark display's written `{ field: 'source' }` still deals the categorical
  palette rather than the subtrack colors:
  [a-mark-colored-by-source-takes-the-subtrack-colors](../ideas/waiting-on-a-call/a-mark-colored-by-source-takes-the-subtrack-colors.md).

## Open: a heatmap's color domain

Under `mark: 'rect'` nothing sits on y, yet the ramp's ends, its log or
symlog placement, its outlier fence and its shared-axis group are
`encoding.y.scale`'s, and the Score range dialog writes there. Every other
display's ramp carries its own `domainMin` and `domainMax`, as Vega-Lite's
heatmap does. On `rect`, `encoding.color.scale.type` already says pair or
threshold or ramp, so moving them there collides:
`log` would have to mean the ramp's placement too, and an unset type, the
pair fading through white, would have no log form. The call is whether a
heatmap's color takes `type`, `domainMin` and `domainMax` and leaves the
fence and group on y, or the y scale stays the heatmap's value scale under
its own name.

## Rejected

| Alternative | Why |
| --- | --- |
| `source` with its own `scale.domain` and `range` | Two homes for the subtrack-to-color map, `rowColor` and the channel, which is ADR-164's trap |
| A per-row negative color (UCSC's `altColor`) | Spends a second hue on the sign the y position already shows |
| Keeping the split as the unset default | Hue changes meaning at the cut on a row that a written `source` paints whole |
