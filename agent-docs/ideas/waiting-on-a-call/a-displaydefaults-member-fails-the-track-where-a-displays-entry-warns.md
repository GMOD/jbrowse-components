---
name: a-displaydefaults-member-fails-the-track-where-a-displays-entry-warns
description: An undeclared member inside a `displayDefaults` value fails the track's load, where the same object in a `displays` entry names the key on the console and draws (ADR-221). The router uses the refusal to pick which displays take a value, so dropping it outright would warn on valid configs; making the two doors agree means warning and dropping the member only when every candidate display refuses for an undeclared member alone, which amends ADR-134. Left open by the 2026-10-07 review of the closed-schema rule.
---

# A displayDefaults member fails the track where a displays entry warns

Left over from the 2026-10-07 review of
[ADR-221](../../architecture-decision-records/adr-221-a-closed-schema-warns-on-load-and-refuses-on-a-write.md),
whose other findings closed with the legacy keys retired.

## The disagreement

A track's `displayDefaults: { color: { field: 'type', scheem: 'tableau' } }`
fails the track's load: `collectDisplayOverrides`
(`packages/core/src/pluggableElementTypes/models/expandTrackConfigShorthand.ts`)
asks each display's colour schema whether it takes the value, the closed
`MarkColor` refuses the misspelt member inside `refusingUndeclaredKeys`, and a
value every candidate refuses is a `refused` entry the track preprocessor
throws on
([ADR-134](../../architecture-decision-records/adr-134-displaydefaults-routes-a-value-to-the-displays-that-take-it.md)).
The same object written on a `displays` entry loads: the colour schema names
`scheem` on the console and draws with the field.

## Why the refusal stays

The router leans on the throw. `color: { field: 'type' }` has to reach the
displays whose colour maps a field and skip the ones whose colour is a plain
value, and the only thing that tells them apart is which schema refuses the
object. Making every undeclared member a warning inside the router would send
a value to displays that cannot draw it, and warn on configs that are right.

## The version that makes them agree

Warn and drop the member only when every candidate display's refusal is for an
undeclared member and nothing else, so a typo in `displayDefaults` costs the
setting and a console line, as it does on a `displays` entry, while a value
of the wrong shape still fails the track with each display's reason. That
needs the refusal to say which kind it is (`slotValueRefusal` returns a
string today), and an amendment to ADR-134's "a value no declaring display
takes fails the track's load".

## The call

Whether a `displayDefaults` typo should cost the track or the setting. ADR-221
chose the setting for every other load door; the handoff that found this took
no position, since the router's load failure is also the only thing that
tells an author their shorthand reached nothing.
