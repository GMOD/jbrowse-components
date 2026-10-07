---
status: Accepted
summary: "The alignments display's read filter is its `filter` slot, `ReadFilter`: a closed object of the flag masks, a read name, a `TagFilter` list and the four read categories as `only | exclude | unset`, with v4's `filterBy` and `tagFilter` lifting into it, so `filter` is the grammar's one word for a predicate on every display, an expression list on the feature displays and a predicate object here, as Vega-Lite spells both; `showOutline` is a `maybeBoolean`; the multi-row display's `rowGroups` is a list of closed `RowGroup` entries. The JSON schema, the editor and `jbrowse validate` see the members, a misspelt member is refused rather than dropped, and `normalizeFilterBy`'s backfill and sanitising go. `modifications` is typed by a commit of its own, where an empty `shownModifications` draws every type, and `sortedBy` stays `maybeFrozen` as menu-written state whose unset is its no-sort"
---

# ADR-218: The read filter and the row groups are typed objects

## Status

Accepted (2026-10-07). Settles call 5 of the 2026-10-07 grammar audit, under
[ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md)'s rule that
a typed sub-schema beats a `frozen` slot where the reader expects a shape.

## Context

ADR-120 left 67 `frozen` slots open in the JSON schema. Most hold an adapter's
sub-config or a metadata blob, but five sat on display grammar: the alignments
display's `filterBy`, `modifications`, `showOutline` and `sortedBy`, and the
multi-row display's `rowGroups`. `filterBy` is in the plot vocabulary, so Edit
plot offered a slot the schema could not describe; `filterBy: { flagExcludes: 4 }`
loaded and did nothing; and `normalizeFilterBy` existed to backfill the masks a
hand-written object left out and to coerce a category value the vocabulary did
not have, both jobs a schema does. Typing one of these after 5.0 refuses
configs that load today.

## Decision

- **The read filter is the display's `filter` slot, `ReadFilter`**
  (`plugins/alignments/src/LinearAlignmentsDisplay/readFilterConfigSchema.ts`),
  where it was `filterBy`: the grammar's word for a predicate is `filter`,
  and Vega-Lite's `filter` takes an expression or a predicate object, which
  is the two forms this tree has, a `jexl:` list on the feature displays and
  a predicate object here. The model reads it as `readFilter` and writes it
  with `setReadFilter`; v4's `filterBy` and `filterBySetting` lift into it.
  `readFilterOf` beside the schema reads each slot through `readConfObject`,
  typed and at its default where unset, as `facetSettingOf` reads a facet; a
  sub-schema's snapshot strips defaults, so no reader takes it whole.
  `flagInclude` and `flagExclude` with the 1540 default, `readName` as a
  `maybeString`, `tagFilters` as a list of closed `TagFilter` entries, and
  `spliced`, `properPairs`, `singletons` and `split` as `maybeStringEnum` over
  `only | exclude`. A v4 session's singular `tagFilter` is a `retired` entry.
  `normalizeFilterBy` goes: the defaults fill the masks and the enum refuses a
  category word the vocabulary lacks.
- **`showOutline` is a `maybeBoolean`**, unset following the unit.
- **`rowGroups` is a list of closed `RowGroup` entries** (`match`, `group`).
- **`modifications` is `AlignmentsModifications`**, typed by `7e13121a3e`
  the same day: an empty `shownModifications` is the default and draws every
  type, so the slot is an ordinary `stringArray` and the menu switches the
  layer off where it wrote `[]`. **`sortedBy` stays `maybeFrozen`**: the menu
  writes it and unset is its no-sort.

## Consequences

- The schema, the config editor and `jbrowse validate` see each member, and a
  misspelt one fails the track's load naming it, as on every `closed` object
  (ADR-133; a key the display itself does not declare only warns, ADR-217).
- `filterBy` leaves `PLOT_VOCABULARY`; `filter`'s line covers both forms, so
  Edit plot on an alignments track shows `filter` as every other display does.
- The worker's RPC argument keeps the name `filterBy`, an internal name no
  config or plugin spells.
- `filterBy: null` resets to the default filter, as every slot does.
- A config writing `properPairs: "all"` is refused where it was read as
  unfiltered; the word the menus use for off is unset.
- jb2export's `flags:` and category modifiers write partial objects the schema
  fills, as before.

## Rejected alternatives

- **A `maybeStringArray` slot type for `shownModifications`.** One slot would
  have added a type to the slot vocabulary, its editor, the JSON schema and the
  guide; reading an empty list as every type needs none.
- **Keeping `normalizeFilterBy` beside the schema.** It restated the defaults
  and the enum in a second place.
