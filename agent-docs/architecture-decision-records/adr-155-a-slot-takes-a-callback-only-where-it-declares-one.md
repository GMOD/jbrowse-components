---
status: Accepted
summary: "A slot takes a `jexl:` callback only where it declares `contextVariable`, the names the callback reads; every other slot refuses one at load, on `setSlot`, in the config editor, in the JSON Schema and in `jbrowse validate`, naming the slot. A slot naming what a display reads per feature is a `featureField`, which the reader hands over as written, so a `jexl:` expression there is a derived field the display evaluates per feature rather than a callback. The snapshot preprocessor repeats the refusal for builds with MST's type check off. No migration"
---

# ADR-155: A slot takes a callback only where it declares one

## Status

Accepted (2026-09-21). Amended 2026-09-27: a list of expressions is its own
slot type, below.

## Context

Every slot's MST type was `<value> | jexl:`, and `readConfObject` evaluated a
`jexl:` string whenever it read one. `contextVariable` was editor metadata: it
gated `SlotEditor`'s value/callback toggle and nothing else. So `jexl:` did two
jobs under one prefix, and neither was checked:

- **A callback**, evaluated by the reader against the names the caller passes.
  A slot whose caller passes nothing still evaluated one, against a context
  where every name is `undefined`, and handed back the fallout as the setting.
  `jexl:-log10(score)` in GWASAdapter's `scoreTransform` plotted every raw
  p-value behind a console warning.
- **A derived field**, which the display evaluates per feature. A color's or a
  facet's `field` holding `jexl:…` was evaluated by the reader first, with no
  feature: a `jexl:` facet field threw out of every canvas fetch reaction, and a
  `jexl:` Manhattan color field threw at display creation.

## Decision

**`contextVariable` is what makes a slot take a callback.** A slot declaring
one is `<value> | jexl:` as before. Every other slot refuses a `jexl:` string,
and the refusal names the slot and says a callback slot lists its callback
args in the config docs. A `jexl:` `defaultValue` on a slot declaring no
`contextVariable` fails at construction.

**A `featureField` slot holds a `jexl:` expression as a value.** Its type is a
string the reader returns raw; the display hands it to `fieldReader`, which
evaluates it per feature. A `featureField` declaring `contextVariable` fails at
construction, because nothing calls it with one. The field references are
`featureField`: `facet.field`, the mark encoding's `x`, `x2`, `y` and `row`, a
mark glyph's `field`, `partitionField`, `clusterField`, and the `field` of
FeatureColor, ManhattanColor and MarkColor. The wiggle, alignments, synteny and
ribbon colors' `field` names one of the display's own dimensions and stays a
plain string, through `colorChannelSlots`' required `fieldType`.

**Every surface refuses the same thing.** The slot's MST type, the snapshot
preprocessor (for builds where MST's type check is off, which is every product
but web), `setSlot` and `slotValueRefusal` through `slotWriteRefusal`, the
color editor, the JSON Schema (`PlainString` and `not: JexlString`) and
`jbrowse validate`'s explanation of it.

## Consequences

- A config that wrote `jexl:` into a slot that never evaluated it usefully now
  fails to load, naming the slot. v5 breaks compatibility without migrations.
- GWASAdapter reads `scoreTransform` raw and declares `score`; the multi-sample
  variant displays' `featureColor` declares `feature`.
- The volvox repeat wiggle tracks lost `jexl:repeatColor(feature)`, a function
  the volvox plugin no longer registers, on a display that colors per signal.
- A `jexl:` entry in a `stringArray` slot loads (`colorArray` and
  `stringEnumArray` refuse one as not a color or not a member). ~~`jexlFilters`
  entries are expressions, and `configuredJexlFilters` reads one the same with
  or without the prefix.~~ (amended below) In a `groupby` or `pileup.fields`, the worker's
  transform throws, pointing at a `formula` step, and in a mark's own
  `transform` the `step-field-expression` rule says so first; the rule does not
  read the display-level `transform`. Refusing entries at load was built and
  backed out (2026-09-21): it replaced that pointer with a generic message, and
  what it newly caught, such as a `jexl:` assembly name, nobody writes.
- `jb2export`'s `color:` modifier cannot carry a `jexl:` value through its `:`
  split.

## Amended 2026-09-27: a list of expressions is `expressionArray`

The display filter list, v4's `jexlFilters`, is `filter`, an `expressionArray`:
a list whose every entry is a `jexl:` expression the display evaluates per
feature, and which refuses a bare entry. v4 stored the entries bare and
prefixed them on read, so the slot, the "Filter by..." override and the Edit as
JSON box spelled one expression two ways, and a bare override entry threw in
the worker on every display but canvas. The session override is
`filterSetting`, held to the same entry type.

The refusal runs on every surface the callback refusal does: the MST type,
`setSlot` (naming the bare entry), the JSON Schema (`JexlExpression`), and
`jbrowse validate`. The config editor puts `jexl:` in front of each entry as a
fixed adornment, so typing never writes a refused entry. Both v4 names load:
the three schemas declaring the slot retire `jexlFilters` with a prefixing lift
(`retiredFilterSpelling`), and the three display models lift a
`jexlFiltersSetting` in `preProcessSnapshot` (`liftRetiredFilterSetting`).
jb2hubs keeps writing `jexlFilters`, since its hosted configs still load in
older releases.

## Rejected alternatives

- **Skipping evaluation when a read passes no args.** Built, measured and
  backed out, as `packages/core/src/configuration/CLAUDE.md` records. Refusing
  the callback where no caller passes names removes the case instead.
- **Keeping `contextVariable` as editor metadata and documenting the trap.**
  `partitionField` shipped broken that way.
