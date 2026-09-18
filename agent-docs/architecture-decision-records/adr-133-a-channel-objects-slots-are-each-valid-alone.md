---
status: Accepted
summary: "No combination of a channel object's slots is refused: a `domain` with no `field`, or a `field` under a scale that reads none, loads and waits unread. `scale` on the Manhattan, multi-way and mark colour objects is unset by default and reads as the scale its field implies (`paintedScale`), so an explicit `none` survives a reload, and a scale switch in a menu keeps the field, order and palette for the way back. Supersedes ADR-131's refusals of a `domain` or `palette` naming no `field` and of a `field` under a non-categorical scale"
---

# ADR-133: A channel object's slots are each valid alone

## Status

Accepted (2026-09-18). Supersedes two refusals in
[ADR-131](adr-131-a-categorical-channel-is-one-config-object.md): a `domain`
or `palette` naming no `field`, and a `field` under any scale but
`categorical` (`normalizeScaledColor`). ADR-131's object, shorthand, `closed`
keys and whole-object writers stand.

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
checks that `domain` and `palette` are lists and carries a numeric `domain` as
strings; `closed` still refuses an undeclared key. Facet, FeatureColor,
ManhattanColor, RibbonColor, MarkColor, MarkGlyph and MarkValue all use it.

**`scale` is unset by default** (`maybeStringEnum`) on ManhattanColor,
RibbonColor, MarkColor and MarkGlyph. `paintedScale` reads it: unset is
`categorical` beside a `field` (MarkColor: `linear` beside a `ramp`) and
`none` without; a scale that reads a field paints `value` until one is named.
Every reader goes through it, so an explicit `none` is a real state that
survives a reload.

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
- The Edit as JSON dialog still refuses a spec naming no field or colour, with
  its own message: a whole-object writer has no intermediate states to pass
  through, and such a spec changes nothing.
- The validator no longer flags a `domain` with no `field`. A config that
  writes one gets no colours by field and no error.
- FeatureColor has no `scale`: its field paints whenever named, and Solid
  color drops it, as the flat slots before ADR-131 did.

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
