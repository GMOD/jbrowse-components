---
name: canvas-interaction-state-mixin
description: Hover, clicked and selection state as one mixin for the canvas-rendered displays, instead of channels each display hand-wires — the multiway display shipped with the clicked channel pinned to 0 and the selection channel ungated because its author wired the two it remembered. What the mixin owns (the ids, the ownFeatureIds selection gate, the render-state fields, the keys-not-indices lifecycle), the three existing implementations it would be extracted from, and why the pick side stays per-display.
---

# A canvas interaction-state mixin

Not committed work. The 2026-09-04 synteny review found the same defect class
twice in one display: `MultiWaySyntenyDisplay` shipped with `clickedFeatureId`
pinned to 0 while the edge pipelines that draw the outline sat compiled and
unused, and with its selection highlight reading the raw session selection so a
click in any other track repacked every lane. Neither was a design decision —
hover was wired, click and the selection gate were not, because each channel is
hand-wired per display and an author wires the ones they remember.

## What the mixin owns

The model-side interaction channels every canvas display repeats:

- `hoveredTarget` / `clickedTarget` volatiles, on the keys-not-indices
  lifecycle ([mechanisms/ui-state-holds-keys-not-indices.md](../mechanisms/ui-state-holds-keys-not-indices.md)):
  a semantic key where one exists, clear-on-commit stated at the commit where
  none does.
- The resolved `hoveredFeatureId` / `clickedFeatureId` getters the render
  state reads.
- `ownFeatureIds` + the gated `selectedFeatureId` — the session selection
  resolved to undefined unless it names a feature this display draws, so a
  foreign selection invalidates nothing downstream.
- The `selectHovered` shape: record the clicked target, open the widget,
  empty-canvas click clears.

## The implementations to extract from

`LinearSyntenyDisplay` (hover/click indices, `setRpcData`'s clear),
`MultiWaySyntenyDisplay` (all three channels, the group-key click, the gate),
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

A smaller seam in the same neighbourhood, separate because it is pairwise-only:
[level-row-pair-getter](level-row-pair-getter.md).
