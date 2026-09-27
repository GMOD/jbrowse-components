---
name: synteny-continuous-ramps-take-a-scheme-and-pinned-ends
description: A numeric synteny colour column is viridis over the span seen, with no scheme and no pinned ends, because SyntenyColor and RibbonColor take range only for a text column's labels. About a day through the shared colorRampSlots and colorDomainEndsSlots; reaches the linear synteny view, dotplot, circular chords and multi-way display.
---

# Synteny's continuous ramps take a scheme and pinned ends

Moved out of `handoffs/scales-and-colour-keys.md` on 2026-09-27; a review that
day sized it and nobody has taken it.

`SyntenyColor` and `RibbonColor` take `range` for a text column's labels
(`1547c3a65d`), but a numeric column gets no `range`, `scheme` or pinned ends:
the three presets carry fixed stops and domains (`continuousRampConfig` in
`packages/synteny-core/src/colorRamps.ts`), and the column is viridis over the
span seen.

## The route

About a day: the shared `colorRampSlots` and `colorDomainEndsSlots`, the presets
as `FieldPresets`, and `resolveContinuousMode` building its stops and domain
with core's ramp helpers, while the accumulated span stays view-level. It
reaches the linear synteny view, the dotplot, the circular chords and the
multi-way display.
