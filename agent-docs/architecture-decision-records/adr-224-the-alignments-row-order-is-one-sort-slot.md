---
status: Accepted
summary: "The alignments displays' pileup row order is one `sort` slot, `AlignmentsSort`: a string names a whole-window order (`position`, `length`, `spliced`, `split`, `svSignal`) and an object a column sort (`{ type, pos, refName, tag }`, with `type` one of `strand`, `basePair`, `tag`, `insertion`, `softclip`, `hardclip`). It replaces `sortedBy` and `layoutOrder`, whose setters cleared each other because the menu is one radio group. `setSort` is the one writer and `sortAtCenterLine` the track menu's; `setSortedBy`, `setSortedByAtPosition` and `setLayoutOrder` go, and the `sortedBy` getter is `sortColumn`. `type` is a closed enum where `sortedBy.type` was a bare string. A v4 session's instance `sortedBy` lifts into `sort`; the v5-beta config keys are not migrated. Amended 2026-10-20: the member is `field`, spelt as `color` and `facet` spell one, so a tag sort is `tags.HP` and `basePair` is `base`"
---

# ADR-224: The alignments row order is one `sort` slot

## Status

Accepted (2026-10-10), from the 2026-10-10 review of LinearAlignmentsDisplay.

## Context

Two config slots answered one question. `layoutOrder` ordered the whole window
and `sortedBy` ranked the reads over one column. The Sort by... menu is one
radio group over both, so `setLayoutOrder` cleared `sortedBy` and the sort
setter reset `layoutOrder`, and `getSortMode` reconciled the two back into the
one radio a reader sees. A config could still set both, and the slot docs
described them as stacking.

`sortedBy` was `maybeFrozen`: its `type` was any string, and a misspelled one
sorted canonically with the menu showing no sort. The GRAMMAR_OF_GRAPHICS audit
had checked the pair against `rows.domain` (pileup rows have no keys) but not
against each other.

## Decision

- **One slot, `sort`**, the closed sub-schema `AlignmentsSort` with `type` as
  its shorthand: `sort: "spliced"`, or
  `sort: { type: "tag", tag: "HP", pos: 1999, refName: "ctgA" }`. A column type
  without `pos` and `refName` is no sort. LGVSyntenyDisplay's
  `LGVSyntenySort` defaults `type` to `length`.
- **`setSort(sort)` writes it whole**, a string or a column; the track menu's
  column sorts go through `sortAtCenterLine(type, tag?)`, which writes only once
  the center line names a base. The variant display's "sort reads here" and the
  pileup's right-click sorts call `setSort`.
- **The runtime keeps two getters**, since the layout takes them apart:
  `sortColumn` (the column sort, refName canonical) and `layoutOrder` (the
  whole-window order, `position` under a column sort).
- **jb2export** writes the slot by name: `sort=split` is the slot, `sort:strand`
  still the center-line option.

## Consequences

One fewer slot, and the setters no longer coordinate. A column sort on another
chromosome now falls back to `position` rather than to whatever `layoutOrder`
held; the menu could not reach that combination. `sortedBy` and `layoutOrder` in
a v5-beta config or session warn on load and are dropped (ADR-221).

## Amendment (2026-10-16): `sort` is a plot word

`sort` joins `PLOT_VOCABULARY`, so "Edit plot..." shows and writes the row
order beside `facet` and `color`, and a plot example can stack split reads
first. Before, the plot refused `{ "sort": "split" }` as a key outside it,
though the row order is as much a grammar setting as the facet beside it.
LGVSyntenyDisplay's `sort` joins its plot the same way.

## Amendment (2026-10-20): `sort` names a `field`

`sort.type` becomes `sort.field`, spelling the fields `color` and `facet`
spell: a tag sort is `{ field: "tags.HP", pos, refName }` where it was
`{ type: "tag", tag: "HP", ... }`, and the base at a column is `base`, the
`baseColor` word, where it was `basePair`. The string shorthand names the field
(`sort: "split"`). `field` is an open string, so the schema refuses a value
that is neither a listed field nor a `tags.XX` tag (`refuseUnknownSortField`).
The fields each order admits do not change: a whole-window order is still one
of `position`, `length`, `spliced`, `split` and `svSignal`, and a column sort
one of the rest.

- **No `order` or `domain` member.** Each field ranks in its own order (`mapq`
  highest first, the abnormal pair orientations over LR), and nothing asks to
  reverse one. Vega-Lite's `order` is the word if one does; the color
  object's `descending` orders a threshold legend, and is not it.
- **No whole-window sort by `strand` or `mapq`.** Packed first-fit, a field
  near 50/50 barely reads as sorted, and `facet` sections it with labels.
- **v5-beta `sort.type` is not lifted**; a v4 session's `sortedBy` lifts into
  the new shape, and `jb2export` keeps `sort:basePair` as an alias of
  `sort:base`.
