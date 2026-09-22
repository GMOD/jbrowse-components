---
name: canvas-interaction-state-mixin
description: Hover, clicked and selection state as one mixin for the canvas-rendered displays, instead of channels each display hand-wires — the multiway display shipped with the clicked channel pinned to 0 and the selection channel ungated because its author wired the two it remembered (both since fixed; it is now the fullest of the three implementations). What the mixin owns (the ids, the render-state fields, the keys-not-indices lifecycle), the three existing implementations it would be extracted from, and why the pick side stays per-display.
---

# A canvas interaction-state mixin

Not committed work. The 2026-09-04 synteny review found the same defect class
twice in one display: `MultiWaySyntenyDisplay` shipped with `clickedFeatureId`
pinned to 0 while the edge pipelines that draw the outline sat compiled and
unused, and with its selection highlight reading the raw session selection so a
click in any other track repacked every lane. Neither was a design decision —
hover was wired, click and the selection gate were not, because each channel is
hand-wired per display and an author wires the ones they remember. Both are
fixed, and the multiway display is now the fullest of the three.

## What the mixin owns

The model-side interaction channels every canvas display repeats:

- `hoveredTarget` / `clickedTarget` volatiles, on the keys-not-indices
  lifecycle ([mechanisms/ui-state-holds-keys-not-indices.md](../../mechanisms/ui-state-holds-keys-not-indices.md)):
  a semantic key where one exists, clear-on-commit stated at the commit where
  none does.
- The resolved `hoveredFeatureId` / `clickedFeatureId` getters the render
  state reads.
- The `selectHovered` shape: hit-test at the click's own point, record the
  clicked target, open the widget, empty-canvas click clears. The hover is
  coalesced to a frame, so a click that reads it instead selects nothing when
  no frame ran since the pointer arrived — a touch tap, or a scripted click.

The session selection is no longer a channel here: `MultiWaySyntenyDisplay`
draws it as the chrome's `selectionInk`, like the pileup, Manhattan,
multi-sample variant and multi-row displays, so it reaches no cell and needs no
gate.

## The implementations to extract from

`LinearSyntenyDisplay` (hover/click indices, `setRpcData`'s clear),
`MultiWaySyntenyDisplay` (hover and click, the group-key click),
and `DotplotDisplay` (hover only today; its click currently resolves the
alignment under the pointer and does nothing —
[let-a-dotplot-click-open-the-alignment-it-is-on](let-a-dotplot-click-open-the-alignment-it-is-on.md)
is the feature the mixin would make cheap). The GPU buffer half is already
shared (`SyntenyRibbonBuffers`); this is the model-side counterpart.

## What stays per-display

Picking. What a hit IS — a glyph, a ribbon target, a dotplot cell — is each
display's geometry, so the mixin takes the display's `hitTest` as its input
rather than owning one. The mixin's value is the lifecycle around the hit, not
the hit.
