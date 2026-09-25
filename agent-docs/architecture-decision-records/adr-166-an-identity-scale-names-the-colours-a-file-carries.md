---
status: Accepted
summary: "FeatureColor takes `scale: 'identity'`: each feature paints the colour it carries — `value` unset, so its own itemRgb, or a `jexl:` callback — exactly as `none` paints it, and the key names each `domain` colour with its `labels` entry, listed whole once anything is drawn, as a threshold's bins are. It reads no field, since the itemRgb column goes by three names (`itemRgb`, `reserved`, `field8`) and the worker already resolves them. A constant `value` paints no colour of the feature's own, so it keys nothing. The multi-row display's `legend` slot goes, refused with the new spelling, and the basic display gains the key its `legend` slot took with it (ADR-163). Amends ADR-163"
---

# ADR-166: An identity scale names the colours a file carries

## Status

Accepted (2026-09-24), Colin's answer to the question
[identity_coloring](../handoffs/identity_coloring.md) left open. Amends
[ADR-167](adr-167-the-feature-colours-scale-resolves-on-the-main-thread.md),
which kept the multi-row display's `legend` slot for a file's own `itemRgb`
relabelled and called that, in grammar terms, an identity scale with labels.

## Context

ChromHMM, the BXD painting, dog10k's copy number, the E. coli projections and
the C-GIAB haplotype track all paint colours the data already carries. The
multi-row display keyed them through `legend`, a hand-typed list of
`{ label, color }` beside the colour object: a second spelling of what
`domain` and `labels` spell on every other scale. The canvas feature display
had lost its own `legend` in ADR-167, so a BED9 on it had no way to name its
colours at all.

## Decision

- **`identity` is a FeatureColor scale.** It paints what `none` paints, so the
  worker, the encode and every drawn pixel are untouched: `colorEncodingOf`
  answers `value` for it. `domain` lists CSS colours and `labels` names them,
  one each in order; a colour past the labels is named by itself.
- **It reads no field.** A file's colour column is `itemRgb`, `reserved` on a
  bigBed or `field8` on a BED9, and `featureBedColor` already resolves the
  three; a `jexl:` `value` covers a colour held anywhere else. A field written
  beside it waits unread, as under `none`.
- **The key lists the domain whole once anything is drawn**, like a
  threshold's closed bins, so a figure's key is the one the `legend` slot drew.
  A constant `value` paints no colour of the feature's own and keys nothing,
  which is also what a Solid color pick over an identity scale leaves.
- **The multi-row `legend` slot goes**, refused through `retiredSettings` with
  the new spelling, and every config, script and tutorial moves onto
  `color: { scale: 'identity', domain, labels }`. The basic display keys an
  identity scale the same way; Edit as JSON reads and writes it.
- `COLOR_SCALES` stays the field scales, so wiggle and the mark display, which
  declare all of those, do not offer identity.

## Consequences

- A key row can name a colour the view has not drawn, as a threshold bin can.
- On the multi-row display a key row still hides the blocks painted its colour.

## Rejected alternatives

- **Identity over a named field**, painting each value as a colour on the main
  thread. It needs the config to know which of three names the colour column
  has, and moves every migrated track onto the field palette for no change in
  the picture.
- **A key of only the colours drawn.** The ChromHMM key would shrink to the
  states in view and every figure's key would move.
