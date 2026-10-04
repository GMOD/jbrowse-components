---
status: Accepted
summary: "Row colour on the multi-row feature, multi-sample variant, wiggle, MAF and mark displays is one channel resolved once: `TreeSidebarMixin.resolvedRowColors` gives each row its `rowColor` entry (a `name` pair, or its attribute value's dealt colour), else its file's own `color`, else a palette colour by name where `rowPaletteDeals`. The palette deals row names only where the rows share one panel (`sharesPanel`, a multi-subtrack wiggle overlay); stacked rows are named by their labels. Attributes always deal, from tableau10 then re-lit laps, and an empty value takes no colour. A row's colour shows as a 4 px bar beside its label, and on the marks only where `rowColorPaintsMarks`. `rowGroups` tags a row's `group` and carries no colour. One mixin key (`rowColorScales`) shows for an attribute or a shared panel, 20 entries then \"+N more\". One shared dialog opens from `rowArrangementMenuItem`. Deletes `rowGroups[].color`, `colorRowLabels`, `labelColor`, `identityChannel`, every per-display deal, wiggle's per-subtrack palette switch, three legend paths and four dialog wrappers. Amends ADR-160 and ADR-164"
---

# ADR-207: A row's colour resolves once and shows beside its label

## Status

Accepted (2026-10-03). Amends
[ADR-160](adr-160-a-rows-colour-is-one-categorical-channel-on-the-row-axis.md),
whose dealer kept each display's palette and order, and
[ADR-164](adr-164-the-arrangement-dialog-shows-the-row-colour-object.md),
whose dialog read each display's identity channel.

## Context

After ADR-160 and ADR-164 the five row displays shared one `rowColor` object
but resolved it five ways. A reader colouring rows by group saw:

- a key on variants at any height, on multi-row only below 6 px rows, and on
  wiggle collapsed by group and colour;
- the label box tinted on variants, MAF and marks, but on multi-row only after
  Show → Color row labels;
- `categoricalPalette` on multi-row and variants, `set1` on wiggle.

Multi-row also had two spellings of a group's colour, `rowGroups[].color` and
`rowColor: { field: 'group' }`, which could draw a red swatch beside blocks of
another colour. The v5.0.0 release allowed the redesign to start from the
grammar rather than from what shipped.

## Decision

- **One channel, one resolution.** A row's colour is its `rowColor` entry,
  else its own colour from the file, else a palette colour by name where the
  display deals one. The coalesce reads like Vega-Lite's `condition` and like
  FeatureColor's `value`, then itemRgb, then default.
- **Colour names a row only where position cannot.** In a facet the label and
  the row's position identify it, so stacked rows get no palette by name
  (`facet_wrap` over one fill). A shared panel needs one (`aes(colour = …)`), so
  a multi-subtrack wiggle overlay deals by name. Colouring by an attribute
  always deals.
- **The palette is tableau10, then re-lit laps** rather than wrapping, so a
  repeated colour never claims two rows are one.
- **An empty attribute value takes no colour**, as ggplot's `na.value` treats a
  missing value as no category; an overlay row left uncoloured draws grey.
- **The colour shows as a 4 px bar beside the label**, always, and fills the
  label run below the text threshold, where it is the only identity. One
  variable per visual variable: the marks take the row colour only where
  nothing else colours them (`rowColorPaintsMarks`), so a chromHMM state and a
  tissue never share a hue.
- **A group is an attribute.** `rowGroups: [{ match, group }]` tags rows, and a
  group's colour is `rowColor: { field: 'group', domain, range }`.
- **One key**, shown for an attribute or a shared panel, at any row height,
  listing at most 20 values in deal order and then "+N more", with "Other" for
  an `unknown` colour; a click focuses the rows. By name on stacked rows there
  is no key: the labels are the key.
- **One dialog.** `rowArrangementMenuItem` opens the shared `SetColorDialog`
  over the model; wiggle passes its own opener for its plot colours. A display
  overrides only the mixin members documented as hooks, which
  `declaredHooks.test.ts` checks.

## Consequences

- A multi-row track with no row colours draws every row in its feature
  colour, where it used to deal a palette colour per row.
- Volvox's parents lose their red group swatch; the "Parents" band names them.
- Wiggle overlays deal tableau10, and wiggle's `color: { field: 'source' }`
  switch is gone.
- Variants list attribute values first seen first, not by count.
- The roadmap and BXD configs carry their group colours in `rowColor`.

## Rejected

- **A row-colour toggle on multi-row** (`colorRowLabels`): a default nobody
  should have to find, replaced by the bar.
- **An `identity` scale for a file's own colours**: it puts the file's colour
  and a reader's per-row colour on one field, so recolouring one MAF species
  would write every species' colour as a pair.
- **No palette under `name` spelled as `scale: 'none'`**: `none` parks the pairs
  on every colour object (ADR-135), so hand-set row colours would stop painting.
- **Parking a Color by under `scale: 'none'` for a way back**, as ADR-135's
  colour objects do: `rowColor` has no `value` to paint meanwhile, and the
  parked pairs were hidden state a reset and the dialog each had to read.
- **A reset that returns the config's field**: it treats a Color by pick as an
  arrangement, which no other Color by is, and a mode switch, which resets the
  arrangement, would drop the reader's Color by.

## Amended 2026-10-04: one rule for custom and reset, and None keeps a grey

An audit of the landing found the "is this the reader's" and "what does a
reset write" rules spelled twice and drifted: over a base
`rowColor: { field: 'group', unknown: '#ccc' }`, a value recolour and a reset
dropped the `unknown`, painted every group a palette colour and still offered
Reset. `rowColorResetTarget` (`rowColorChoice.ts`) is now both: the snapshot a
reset writes, or undefined while nothing is custom, and the target is never
itself custom. `resetRowStyling`, a public action with no consumer that also
skipped the persist, is gone; `resetRowArrangement` is the one reset. The
variant menu's None writes the dialog's `{ field: 'name' }` rather than
parking. The reset rule itself is amended again below.

The same module holds what the dialog's choice writes
(`rowColorChoiceSetting`, from the display's `rowPaletteDeals`), so one rule
decides what None means: `unknown: ''` where the palette deals, and on stacked
rows by `name` with a colour `unknown` kept, since a config painting the listed
rows and greying the rest reads as None there rather than as an Each row the
dialog does not offer. The `unknown` itself is a swatch: "Other rows" under
None and Each row, "Other values" with its row count under an attribute,
opening on the config's (`keptUnknown`) and returning to automatic by its own
Auto button, so the grey the key shows as "Other" is a reader's setting like
every other colour; a value with no pair of its own shows the colour it
inherits as a dashed swatch. The variant menu's None is checked over such a
config and a pick is a no-op, as it already was over `name` pairs alone. The
dialog's value table lists an attribute's values in the key's order. The key
over a shared panel is titled by a new hook, `rowNoun` ("Subtrack" on wiggle),
not "Name". Variants' `rowColorField` became the mixin's `rowColorAttribute`.

## Amended 2026-10-04: `rowColor` has no `scale`, and a reset keeps the field

A scope review found two leftovers of parking. Once the variant menu wrote the
dialog's object, nothing a reader did wrote `scale: 'none'` on `rowColor`, and
`rowColor` has no `value` for a parked field to stand behind (ADR-135's reason
to park), so a hand-written `none` was only a second spelling of None. The
`scale` slot is gone from `RowColor`, and with it every `scale !== 'none'`
branch in the rules, the dealer and the key. A config naming it is refused,
as any closed schema refuses an unknown member.

The reset rule had grown a clause per case and still disagreed with itself:
over a base `{ field: 'population', unknown: '#ccc' }`, picking another
attribute offered Reset, since the menu drops an `unknown` on a field change,
while over a base with no grey the same pick did not; and a reset over another
attribute wrote the base's grey onto it, which turns every unpaired value grey.
`rowColorResetTarget` is now one rule: the target is the live field with the
colours the base gives that field, none where the base colours by another. A
reset recolours and never changes what the rows are coloured by, as no other
Color by in the app is undone by "Reset row order", and a field switch,
None included, is never custom. None over a configured Color by therefore
offers no Reset; the reader picks the attribute back from the same radio
group. Pairs compare as a set, so a dialog listing them in another order is
not custom.

The variant menu's Samples group ticks a configured attribute the samples
lack, as the dialog shows it chosen, rather than ticking nothing.

