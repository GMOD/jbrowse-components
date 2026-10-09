---
status: Accepted
summary: "A settings bag, a session spec, a share link and jb2export write `rows` and every color object whole on every display, where the multi-sample variant and MAF displays merged `rows` member by member and LD and Hi-C merged `color`, so one share link kept a clustering tree beside an order it no longer listed on one display and dropped it on another. The two displays' `rows` is `SampleRows`, the shared `Rows` object with `sample` as its one field, and LD and Hi-C color take the bare-string field shorthand every color object with no constant of its own takes. `scales` is the one namespace left, and the write mode stays derived from the shorthand rather than declared"
---

# ADR-215: `rows` and color write whole on every display

## Status

Accepted (2026-10-07). Settles call 2 of the 2026-10-07 grammar audit;
narrows [ADR-142](adr-142-one-value-scale-object.md) §"A partial sub-schema
write merges" to `scales`. Amended 2026-10-09: the shorthand claim below
covers the color objects that declare no `value`.

## Context

ADR-142 made a settings bag merge a namespace member by member and replace a
channel whole, telling the two apart by whether the schema declares a
`shorthand`. Two objects fell on the wrong side of that line. `rows` was the
`Rows` channel (a `field` shorthand) on wiggle, the mark display, Manhattan
and multi-row, but the bare `RowArrangement` namespace on the multi-sample
variant and MAF displays, whose rows are the file's samples and name no
field. `color` declared no shorthand on LD and Hi-C alone. So the same share
link writing `rows: { domain: [a, b] }` kept a clustering tree beside an
order it no longer listed on the variant display, where the display's own
reorder drops the tree, and on wiggle cleared the field and switched rows
off; and `color: 'dprime'` on LD was refused where `color: 'identity'` on MAF
lifted.

## Decision

- **`SampleRows`** (`@jbrowse/display-kit/sampleRowsConfigSchema`) is the
  shared `Rows` object with `sample` as its one field, defaulting to it, as
  `QuantitativeRows` is with `source`. The multi-sample variant and MAF
  displays declare it, so `rows` is one object with one write rule on every
  display, and `rows: "sample"` is legal and arranges nothing.
- **LD and Hi-C color declare `shorthand: 'field'`**, as MAF's does, so a
  bare string names the field on every color object that has no constant. One
  that declares a `value` keeps the constant shorthand, as
  [ADR-159](adr-159-a-mark-is-spelt-as-vega-lite-spells-one.md)'s amendment
  keeps it for a display-level color, and a field name written there is
  refused with the `{ "field": … }` spelling (`colorChannelOptions`).
- **`scales` is the one namespace**, and the rule that a shorthand marks a
  channel stands: with every color object and every `rows` a channel, the
  derivation and a declared write mode would say the same thing.

## Consequences

- A share link or spec writing `rows: { domain }` on the variant or MAF
  display drops the tree, labels and focus with it, as the display's own
  reorder does; a member meant to survive is written with the rest.
- `plot` on those displays shows `rows` as before, since the field sits at its
  default and is stripped.
- A v4 clustered variant session still lifts into `rows` (ADR-168), now onto
  `SampleRows`.
- `RowArrangement` stays as the members every `Rows` composes.

## Rejected alternatives

- **A declared write mode on the schema** (`writes: 'whole' | 'members'`). One
  more option on every schema to say what the shorthand already says, once
  the two stragglers were channels.
- **Giving `RowArrangement` a `domain` shorthand.** A bare value for rows on
  a sample display would have been a list, which no shorthand takes, and the
  field is the shorthand everywhere else.
