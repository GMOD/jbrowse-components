---
status: Accepted
summary: "FeatureColor takes `scale: 'identity'`: each feature paints the color it carries, such as its itemRgb, and the key names each `domain` color by its `labels` entry. The multi-row display's `legend` slot goes. Amends ADR-167."
---

# ADR-166: An identity scale names the colors a file carries

## Status

Accepted (2026-09-24), Colin's answer to the question the identity-coloring
round left open. Amends
[ADR-167](adr-167-the-feature-colors-scale-resolves-on-the-main-thread.md),
which kept the multi-row display's `legend` slot for a file's own `itemRgb`
relabelled and called that, in grammar terms, an identity scale with labels.

Amended by [ADR-243](adr-243-a-mark-paints-a-files-own-colors-through-an-identity-key.md): the mark display takes the identity scale too.

Amended 2026-11-11: identity reads a written `field` on the feature displays
and the variant display as the mark display does
([ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md)),
each feature painting the CSS color the field holds, a part with none taking
its nearest ancestor's. With no field it still paints the file's own color,
and a set `value` still paints over both. The worker gets the field as
`WorkerColor.identityField`, apart from the parked field `color.field` ships.

## Context

ChromHMM, the BXD painting, dog10k's copy number, the E. coli projections and
the C-GIAB haplotype track all paint colors the data already carries. The
multi-row display keyed them through `legend`, a hand-typed list of
`{ label, color }` beside the color object: a second spelling of what
`domain` and `labels` spell on every other scale. The canvas feature display
had lost its own `legend` in ADR-167, so a BED9 on it had no way to name its
colors at all.

## Decision

- **`identity` is a FeatureColor scale.** It paints what `none` paints, so the
  worker, the encode and every drawn pixel are untouched: `colorEncodingOf`
  answers `value` for it. `domain` lists CSS colors and `labels` names them,
  one each in order; a color past the labels is named by itself.
- **It needs no field.** A file's color column is `itemRgb`, `reserved` on a
  bigBed or `field8` on a BED9, and `featureBedColor` already resolves the
  three. A color held anywhere else is a written `field`, whose CSS colors
  paint (amended 2026-11-11; this said a field waited unread, as under
  `none`).
- **The key lists the domain whole once anything is drawn**, like a
  threshold's closed bins, so a figure's key is the one the `legend` slot drew.
  A constant `value` paints no color of the feature's own and keys nothing,
  which is also what a Solid color pick over an identity scale leaves.
- **The multi-row `legend` slot goes**, and every config, script and tutorial
  moves onto
  `color: { scale: 'identity', domain, labels }`. The basic display keys an
  identity scale the same way; Edit as JSON reads and writes it.
- `COLOR_SCALES` stays the field scales, so wiggle and the mark display, which
  declare all of those, do not offer identity.

## Consequences

- A key row can name a color the view has not drawn, as a threshold bin can.
- On the multi-row display a key row still hides the blocks painted its color.

## Rejected alternatives

- **Identity over a named field**, painting each value as a color on the main
  thread. It needs the config to know which of three names the color column
  has, and moves every migrated track onto the field palette for no change in
  the picture. Taken up as an option on 2026-11-11: with no field identity
  still reads the BED color under whichever of its three names the file uses,
  so the config never has to name the column, and a field paints only where
  one is written.
- **A key of only the colors drawn.** The ChromHMM key would shrink to the
  states in view and every figure's key would move.
