---
status: Accepted
summary: "The canvas feature and variant displays' Color by radios pick what paints, the track's own `color.value` (Default) or a field, and Solid color is an action that writes that value. Picking a field keeps `value`, so Default returns to a track author's color, as multi-way's Genes Default already did. A per-display color override and a per-slot reset over `trackConfigDeltas` were both declined"
---

# ADR-154: The color menu's Default is the track's own color

## Status

Accepted (2026-09-21). Narrows what
[ADR-135](adr-135-the-color-objects-share-one-shape-and-a-preset-is-a-field.md)
says Solid color and Default write.

## Context

A track author's color, often a `jexl:` expression no menu can re-enter, sat
in `color.value`. On the canvas feature display the Color by radios were
Default, Solid color, Strand and Attribute. A track opened with its own color
ticked Solid or Attribute, and every pick rebuilt the color object without
`value`, so Default meant the built-in color and the author's was gone.
Multi-way's Genes menu kept `value` and had no Solid item, so its Default
returned to the author's color.

The loss is not particular to color: every track-menu pick writes the track's
config slot. Color is where it shows, because an authored expression cannot be
picked again from the menu.

## Decision

**The radios pick what paints, the track's own value or a field.** `colorByMode`
reads the painting field alone: `strand`, `attribute`, or `default` with none,
whatever `value` holds. Picking a field keeps `value`, and Default
(`setColorScale()`) keeps the field under `scale: 'none'` for the way back.

**Solid color is an action.** It writes `value`, which is the one pick that
replaces the author's color. Its dialog names a `jexl:` expression it would
replace.

**The variant display's presets write `value`**, so Default clears one that
paints and otherwise keeps the track's own.

## Consequences

- After a Solid pick, Default is ticked and paints the user's color. On Web a
  non-admin's pick is a delta in the session, so undo and the track's Reset
  still reach the author's color.
- On Desktop, which runs in admin mode, a Solid pick rewrites the user's own
  config and undo does not cover admin config edits. That is every setting, not
  color, and is its own thread.

## Rejected alternatives

- **A per-display color override prop**, painting override-else-config. It is
  the `ConfigOverrideMixin` that
  [CONFIG_PATTERN.md](../reference/CONFIG_PATTERN.md) records as collapsed, it
  gives color a second spelling beside the slot a spec and the config editor
  write, and a display prop dies on hide and re-show.
- **A per-slot reset over `trackConfigDeltas`** with a "Track's color" row. It
  only reaches a non-admin's config.json tracks, who already have undo and the
  track's Reset; session tracks are live nodes edited in place, and a
  connection track's only base is the live connection. A row shown only when
  the delta changes the color also draws a state it cannot explain, the
  failure [ADR-111](adr-111-display-type-defaults-backed-out.md) records.
