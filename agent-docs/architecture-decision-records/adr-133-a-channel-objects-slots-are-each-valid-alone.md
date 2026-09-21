---
status: Accepted
summary: "No combination of a channel object's slots is refused: a `domain` with no `field`, or a `field` under a scale that reads none, loads and waits unread. `scale` on the Manhattan, multi-way and mark colour objects is unset by default and reads as the scale its field implies (`paintedScale`), so an explicit `none` survives a reload, and a scale switch in a menu keeps the field, order and palette for the way back. Supersedes ADR-131's refusals of a `domain` or `palette` naming no `field` and of a `field` under a non-categorical scale. ADR-151 spells `palette` and `ramp` as `range` and `scheme` and drops MarkColor's `linear` beside a ramp"
---

# ADR-133: A channel object's slots are each valid alone

## Status

Accepted (2026-09-18). Supersedes two refusals in
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md): a `domain` or
`palette` naming no `field`, and a `field` under any scale but `categorical`
(`normalizeScaledColor`). ADR-131's object, shorthand, `closed` keys and
whole-object writers stand.
[ADR-151](adr-151-a-channels-scale-is-spelt-as-scales-y-spells-one.md) spells
the objects' `palette` and `ramp` as `range` and `scheme`, and reads a field's
kind off `scale` alone, which retires the MarkColor exception below; the rule
this record states stands.

## Context

A review of ADR-131's landing ran the config editor against the new objects.
The editor recurses into a sub-schema and writes one slot at a time through
`setSlot`, which never sees the object's preprocessor. From
`color: { field: 'population' }`, picking scale `ld` saved
`{ field, scale: 'ld' }`, which the object refused on reload, so the track
failed on session restore. Checking each slot write against the whole object
does not fix that on its own: moving between two valid objects one slot at a
time passes through a refused one, and some moves (from `{ scale: 'ld' }` to
`{ field }`) had no order that avoided it.

A second defect sat under the first. `scale` defaulted to `none`, and a
snapshot strips a default, so `{ field, scale: 'none' }` saved as `{ field }`
and reloaded as `categorical`. The menus had the matching symptom: Field →
Single color → Field came back empty, because Single color had to drop the
field for the object to load.

## Decision

**A channel object refuses keys and types, never a combination.** The one
preprocessor, `normalizeChannel` (`@jbrowse/display-kit/colorConfigSchema`),
checks that `domain` and ~~`palette`~~ `range` (ADR-151) are lists and carries a
numeric `domain` as strings; `closed` still refuses an undeclared key. Facet,
FeatureColor, ManhattanColor, RibbonColor, MarkColor, MarkGlyph and MarkValue
all use it.

**`scale` is unset by default** (`maybeStringEnum`) on ManhattanColor,
RibbonColor, MarkColor and MarkGlyph. `paintedScale` reads it: unset is
`categorical` beside a `field` ~~(MarkColor: `linear` beside a `ramp`)~~
(superseded by ADR-151: a ramp asks for `scale: 'linear'`) and `none` without; a
scale that reads a field paints `value` until one is named. Every reader goes
through it, so an explicit `none` is a real state that survives a reload.

**A slot the scale does not read waits.** `{ field: 'population', scale: 'ld' }`
paints by LD and keeps the field. The Manhattan Single color and LD items and
the multi-way scheme modes write the scale over the whole object, so picking
the field again finds its order and palette; picking a different field still
starts from neither.

## Consequences

- `ChannelObjectSlotWrites.test.ts` (jbrowse-web) walks every registered
  display for sub-schemas declaring a `shorthand`, writes each slot through the
  editor's own `makeSlotFacade`, and requires the result to reload as written.
  A combination refusal added to any channel object fails it.
- The rule holds one level up, for a mark. The mark display's load check
  (`checkMarks`) refused a bar naming no `y`, a channel its shape does not
  read, a span's unpinned ramp and an open ramp domain, and
  `slotWritesReload.test.ts` found an editor write reaching each: changing a
  bar to a span, emptying `y`, touching any glyph slot on a bar, typing a
  ramp's domain one entry at a time. The track was then dropped from the
  session it was saved in. A load now refuses a key, a type and an unknown
  shape. `markProblems` reports every combination, and what marks do to each
  other besides: a valued mark beside a stacked span, two marks packing rows
  of their own, a `y` its own steps do not write. The display draws what it
  can, says the rest in its corner notice, and hands the same lines to an
  agent's settle report as `notices`, since a display that loads raises no
  snackbar. A bar naming no `y` is the mark schema's own `requires` entry, read
  by `requirementProblems` for the notice and carried into the generated JSON
  Schema as `if`/`then` for an editor; `jbrowse validate` reports that entry
  and, from a generated copy of the rule list
  (`scripts/generateMarkRules.ts`), every other rule — an error where a mark
  draws nothing, never draws or cannot run its steps, a warning where a slot
  waits unread. A file has no intermediate editor states, so what a load must
  not refuse a validator may.
- The Edit as JSON dialog still refuses a spec naming no field or colour, with
  its own message: a whole-object writer has no intermediate states to pass
  through, and such a spec changes nothing.
- The validator no longer flags a `domain` with no `field`. A config that
  writes one gets no colours by field and no error.
- ~~FeatureColor has no `scale`: its field paints whenever named, and Solid
  color drops it, as the flat slots before ADR-131 did.~~ Superseded by
  [ADR-135](adr-135-the-colour-objects-share-one-shape-and-a-preset-is-a-field.md):
  FeatureColor has `scale`, and Solid color keeps the field under `none`.

## Rejected alternatives

- **Check each editor write against the whole object.** It needs a write order
  that stays valid at every step, and `{ scale: 'ld' }` → `{ field }` has none;
  a text field could not be emptied while a `domain` was set. It also leaves
  the menus dropping the field on a scale switch.
- **An object-level editor for a `closed` sub-schema**, validating a draft
  and committing only valid states. The same stuck states reappear as a form
  that refuses to save, and the menus keep their problem.
- **Keep `scale: 'none'` as the default and infer `categorical` in the
  preprocessor**, as MarkColor did. The strip-on-default snapshot cannot tell
  an explicit `none` from an absent scale, so a dormant field reloads painting.
