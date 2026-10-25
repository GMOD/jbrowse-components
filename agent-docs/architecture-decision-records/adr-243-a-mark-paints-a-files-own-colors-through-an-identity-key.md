---
status: Accepted
summary: "The mark display's `color` takes `scale: 'identity'`, ADR-166's scale: with `value` unset, each feature paints the BED color it carries, `invalid` paints one carrying none, and the key lists `domain` named by `names` once anything is drawn. The worker keys each feature by the `r,g,b` its color parses to under UCSC's `itemRgb on`, parsing each distinct raw value once, and the main thread paints the keys (`ColorSource` `identity`), so `domain`, `names` and `invalid` refetch nothing. The Edit plot scale picker leaves identity out, since it reads no field. First of the gaps between the mark display and the multi-row display it is to replace. Amends ADR-166 and ADR-202"
---

# ADR-243: A mark paints a file's own colors through an identity key

## Status

Accepted (2026-10-25). The first gap in
`ideas/waiting-on-a-call/multi-row-is-the-mark-display-with-a-default-plot.md`.
Amends [ADR-166](adr-166-an-identity-scale-names-the-colors-a-file-carries.md),
which kept identity off the mark display, and
[ADR-202](adr-202-every-mark-color-resolves-on-the-main-thread.md), whose
`ColorSource` gains a fifth kind.

## Context

ChromHMM and the BXD painting color each feature in the file. The only way
to say that on the mark display was `jexl:'rgb(' + feature.itemRgb + ')'`,
which names one of the color column's three names (`itemRgb`, `reserved`,
`field8`), runs jexl per feature and ran the bench's painting arm at 0.64-0.66x
of the multi-row worker against 0.46-0.50x for a key over the column.

## Decision

- **`identity` is a mark color scale.** With `value` unset it paints each
  feature's own color; a `jexl:` value still paints through the worker, and
  a constant paints the constant and keys nothing, as ADR-166 has it.
- **The worker keys the parsed color.** `{ scale: 'identity' }` crosses the
  wire. `encodeFeatures` reads the first of the three column names any row
  fills, keys each feature by `featureItemRgb(raw, true)`, `''` for none, and
  sends the `colorKey` lane with an `identity` table of the colors met.
- **The main thread paints the keys**, `invalid` over the no-color key, so an
  edit to `domain`, `names` or `invalid` fetches nothing.
- **The key lists `domain` whole** once the view draws any of the colors, each
  under its `names` entry; a hover names a color by its row.
- **Edit plot's scale picker leaves identity out.** The picker sits beside a
  field, which identity does not read.

## Consequences

- An identity color with no `domain` keys nothing. Multi-row names each color
  by the features painted in it; the mark display has no such key yet.
- Two raw spellings of one color, `255,0,0` and the packed `16711680`, share
  a key.

## Rejected alternatives

- **Painting the colors in the worker.** No edit then repaints without a
  fetch, and hiding a key row and clustering on color, the next gaps, want
  the key.
- **A categorical key over a named field.** The config would have to know
  which of the three names the file uses, as ADR-166 found.
