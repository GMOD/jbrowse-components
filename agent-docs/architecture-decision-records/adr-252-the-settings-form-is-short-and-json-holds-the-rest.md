---
status: Accepted
summary: "The Settings widget (`ConfigurationEditor`) is a short form: the config's own non-advanced slots, the slots of its adapter and of each sub-schema's adapter (with the adapter's own sub-schemas, such as a BAM's `index`), and the non-plot slots of the display the view draws. \"Edit as JSON...\" edits the whole config snapshot, checked as a write (`refusingUndeclaredKeys`) and refusing a new `trackId`, and applies it with `applySnapshot`. The recursive accordion tree, its filter box, the per-level advanced toggles, and the union list's type picker, add, remove and reorder go; the last amends ADR-150"
---

# ADR-252: The settings form is short, and JSON holds the rest

## Status

Accepted (2026-10-27), Colin: "the full config editor is so complex i would
nearly never recommend it", then "do whatever you think is best".

## Context

- The editor rendered every slot of every sub-schema of every display a track
  type declares. With only its adapter set, a BED `FeatureTrack` drew 289 field
  editors under about 90 nested accordions, headed like `display 3
  LinearManhattanDisplay➔mark 1➔encoding➔strokeWidth➔scale`, most labelled
  `show`, `field`, `domain` or `value`.
- Most of that depth is the grammar objects (`encoding`, `facet`, `rows`,
  `rowColor`, `legend`), which "Edit plot..." already edits as text (ADR-204).
- Assemblies and connections embed the same component.

## Decision

- **The form holds what most edits touch.** The config's own slots, minus
  `advanced` ones; a "Data" section of the adapter's slots and those of its
  sub-schemas; a section per sub-schema holding an `adapter` (an assembly's
  `sequence`, `refNameAliases`, `cytobands`); and the drawn display's slots
  minus its plot keys, with a pointer to "Edit plot...". The editor opened
  with no view shows no display.
- **"Edit as JSON..." holds everything else.** The text is the config's
  snapshot, so it shows what is written and a deleted key returns to its
  default. A draft is built as a write would build it, so an undeclared key or
  a bad value is refused under the field, and a new `trackId` is refused.
- **The value editors resync.** A number, JSON or callback field holds a
  draft only while focused; callback mode follows the stored value; a
  `maybeBoolean` is a default/on/off choice.

## Consequences

- A union list (ADR-150's transform steps) loses its type picker and
  reorder buttons; the JSON text edits it.
- Browsing every setting with its description is the config reference's job;
  the dialog links the schema's page.
