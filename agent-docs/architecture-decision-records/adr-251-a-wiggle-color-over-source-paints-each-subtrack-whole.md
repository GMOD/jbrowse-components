---
status: Accepted
summary: "The wiggle display's `encoding.color` takes a `field`, `score` or `source`. `source` paints each subtrack its resolved row color (`rowColor`, then the file's `color`, then the palette over a shared plot) on both sides of the `origin`, and reads no `scale`; a subtrack with no color paints the score's pair. A color writing nothing colors by `source` on bars, points and lines and ramps the score on a heatmap, so a lone BigWig keeps its pair. The split default goes: a row per subtrack no longer paints its row color above the cut and the shared negative color below it, since the y position already shows the sign. `perSource` leaves gpuProps. ADR-207's deleted `source` switch returns as a field of the one color object. A heatmap's ramp keeps reading `encoding.y.scale`, the plotted value's one scale, whichever mark places the value. Amended the same day: the mark display's categorical color over the field the rows split on takes the row colors too"
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
- `wiggleColorsBySource` is the one rule, which the model and
  `wiggleTables` read; the plot color line reads the colors it hands each
  source (`markSources`). `perSource` leaves gpuProps, since a source's own
  color decides its two sides.

## Consequences

- The display now draws a stacked multi-wiggle whose subtracks carry colors
  and signed scores in one color per row. The in-tree multi-wiggles with declared colors
  plot non-negative scores, so their pictures hold; jb2hubs' hosted composites
  were not checked.
- Two other pictures follow the same rule. A shared plot whose row colors are
  None, or name a field no row carries, deals nothing, so its subtracks paint
  the pair where they painted the positive color on both sides. A lone
  subtrack with a color paints it on both sides, where its negative side was
  red.
- `{ field: 'score' }` keeps the pair beside colored subtracks, which before
  took a written range.
- The arrangement dialog's two plot swatches hide while some subtrack paints
  its own color, since a pair written over it would recolor every subtrack.
- GRAMMAR_OF_GRAPHICS.md drops its "one channel carries two variables" gap,
  and ADR-227 its last color reason.
- Amended 2026-10-27, the mark display: a categorical color over the field
  the rows split on paints each row its resolved row color, as a mark naming
  no color already did (`withRowColors`). The scale deals as written and the
  row colors then replace its colors on the rows that have one, instances
  and key entries both, so a written `range` colors only the rows with none,
  `scale.names` keeps pairing with the written `domain`, and no palette slot
  moves. The methylation tutorial's track, which repeats its subadapter
  colors there, draws as before.

## A heatmap's ramp reads the y scale

Decided 2026-10-27, Colin asking the session to make the call. Under
`mark: 'rect'` nothing sits on y, yet the ramp's ends, its log or symlog
placement, its outlier fence and its shared-axis group are
`encoding.y.scale`'s, and the Score range dialog writes there. They stay
there.

- **The plotted value has one scale, and the mark only chooses where it
  lands.** A wiggle color maps the value `y` plots (`score` stands for it
  whatever field `y` names), so its ends are the y scale's on every mark, as
  a gradient over bars already reads them (ADR-175, ADR-185). Moving them
  onto the color on `rect` alone would spell one concept in two places
  depending on the mark, against GRAMMAR_OF_GRAPHICS.md's rule 2, one object
  per concept.
- **Plot type is one click.** Bars and a heatmap of the same track show the
  same numbers, so a pinned range, a log placement and a fence carry across
  the switch. Under a color-owned domain the switch drops a pinned range, or
  the menu copies it, a second write to keep two settings equal.
- **`group` shares one range across tracks**, and a bar track and a heatmap
  track in one group keep agreeing.
- The color holds what only a color says: the ramp or threshold, `range`,
  `scheme`, `reverse`, the cuts and `domainMid`, all in the value's units.
- The guide follows: on a heatmap the ramp key takes the axis's place
  (`scoreRampReplacesAxis`), so the y scale's one guide still shows its
  domain.

## Rejected

| Alternative | Why |
| --- | --- |
| `source` with its own `scale.domain` and `range` | Two homes for the subtrack-to-color map, `rowColor` and the channel, which is ADR-164's trap |
| A per-row negative color (UCSC's `altColor`) | Spends a second hue on the sign the y position already shows |
| Keeping the split as the unset default | Hue changes meaning at the cut on a row that a written `source` paints whole |
| A heatmap's color taking `type`, `domainMin` and `domainMax` on `rect`, the fence and group left on y | One value scale spelled in two places by mark, a pinned range lost on a Plot type switch, and `scale.type` already meaning pair, threshold or ramp there, so `log` would take a second meaning and the unset pair would have no log form |
