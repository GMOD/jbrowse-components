---
name: display-height-redesign
description: Three options for retiring the `heightOverride` name in `TrackHeightMixin`, and what each costs in snapshot migration.
---

# Display height system redesign

`TrackHeightMixin` persists `heightOverride` (`types.maybe`, `>= MIN_DISPLAY_HEIGHT`); the
`height` getter resolves `heightOverride ?? config.height`, and a `preProcessSnapshot`
migration rewrites a bare `height` (or legacy `heightPreConfig`) in incoming snapshots to
`heightOverride` — the `<name>Override` convention resolves the prop/getter name
collision. `LinearMultiRowFeatureDisplay` layers a second knob (`rowHeightOverride`: `0` =
auto-fit rows to `heightOverride ?? config.height`, `>0` = pinned px/row).

Friction: (1) you can't set `height` natively in a display snapshot — only
`heightOverride` works, via the back-compat migration; (2) for multi-row,
`heightOverride` means "total" while `height` means "resolved total," easy to confuse;
(3) two override knobs (`heightOverride` total vs `rowHeightOverride` per-row) interact
non-obviously — setting `height` silently no-ops when a non-zero `rowHeight` is pinned;
(4) the serialized name carries `Override`, which the user would rather it didn't.

Redesign options, not yet implemented: **A** — give one display a native settable
`height`, smallest blast radius, doesn't help other displays; **B** — refactor
`TrackHeightMixin` globally to a persisted native `height` seeded from the config default,
delete the migration, touches every display + needs broad testing, and loses today's
`heightOverride !== undefined` signal for "user explicitly set a height" vs "using
config default"; **C** — `types.snapshotProcessor` exposing `height` externally while
keeping `heightOverride` internally, medium blast radius, only half-satisfies "no
Override in the name." Whichever is chosen, decide the `height` (total) vs `rowHeight`
(per-row) precedence for multi-row — simplest model: setting `height` wins as auto-fit.
Any change here should be reconciled with the `<name>Override` convention in
`~/.claude/CLAUDE.md`, which would need an explicit exception (or revision) for
resolved-default values like height.
