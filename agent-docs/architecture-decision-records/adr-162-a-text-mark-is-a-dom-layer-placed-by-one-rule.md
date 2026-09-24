---
status: Accepted
summary: "The mark display's fourth mark is `text`, spelt as Vega-Lite and GenomeSpy spell it (`mark: 'text'`, `encoding.text`), and it is a layer and not a shape: the worker fills a `text` lane of strings beside the lanes it already fills, one pure rule (`placeTextMarks`) places every label over the middle of its span, just above its `y` or in the middle of its band, culls left to right and keeps the plot's edges, and the screen emits DOM text where the export emits `<text>`, both through display-ui's `FloatingText` and `SvgHaloText`, which the canvas feature labels and the arc labels' export now emit through as well. The GPU mark list skips the entry and every shape carries its `markIndex`, so the list may be shorter than `marks`. A text mark declares no ink and answers no hover; its colour is the theme's text colour where the config leaves it at the mark default; it folds its `y` into the one axis and asks for no `y` lane when it names none; it moves no point inset. Amends ADR-106's Text bullet and ADR-110's label clause. No migration"
---

# ADR-162: A text mark is a DOM layer placed by one rule

## Status

Accepted (2026-09-24), the text layer the grammar handoff listed next, built on
Colin's 2026-09-23 call that the layer draws DOM text on screen for
accessibility.
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) and
[mark_display.md](../../website/docs/config_guides/mark_display.md) carry the
operational description.

## Context

A `marks` list drew bars, points and spans and could not label a peak, an SV or
a gene: the second gap a user met after `y2`. Seven plugins draw text by hand,
several with the same stroke-then-fill halo, and two media are in use — canvas's
feature labels are DOM on screen and a painter in the export, the arc and MAF
labels paint an overlay canvas. A text mark cannot be a render-core `MarkShape`:
that interface needs a `.slang` pass, and GPU text needs a glyph atlas nobody
has asked for. `INTERACTION_PERF.md` measured that a `fillText` inside the frame
loop flushes style recalc, which is why ADR-106 kept labels off the mark layer.

## Decision

- **The mark is `text`, spelt as Vega-Lite and GenomeSpy spell it.** `mark:
  'text'` and `encoding.text`, a feature field defaulting to `name`, beside the
  `y`, `row` and `color` channels every mark reads. `y` is optional on it: with
  one the label stands just above the value on the display's one axis, and its
  values fold into the domain as ADR-141 requires; without one it stands in the
  middle of its row band, and the request asks the worker for no `y` lane, so
  no lane of zeros stands in for a value. `MARK_SPECS` says which: `value` is
  `required` for bar and point, `optional` for text, `none` for span, and
  `readsValue` keeps the schema's requirement and the density stand-in to bar
  and point while `plotsValue` admits text to the axis.
- **The worker fills a `text` lane of strings.** `LaneName` gains `text`,
  `EncodedChannels.text` is `valueText` of the field per admitted instance,
  `''` where empty, cloned across the wire beside the transferred typed lanes.
  The facet's hidden-section filter drops it with the rest.
- **The GPU mark list skips the entry, and every shape carries its
  `markIndex`.** `buildMarkList` answers one `defineMark` per entry with a
  shape, so the list is shorter than `marks` where a text is declared;
  `findMarkHit` and `hoverInk` translate between list position and mark index
  through `DisplayMark.markIndex`. A text mark declares no ink, asks for no
  hit index and answers no hover or click, which keeps ADR-110's clause that a
  label is DOM text and the display derives nothing about where it is: a
  pinned feature's label is not boxed.
- **One placement rule, two emits.** `placeTextMarks` (pure, over the entries,
  the loaded regions, the render blocks and the render state) places each
  label over the middle of its span in px, at `pointYPx` of its value minus a
  gap or under the value where the band has no room above it, or at the band's
  middle, measures it through `measureText`, and keeps labels left to right
  where no kept label's halo meets their glyphs and the plot holds them whole.
  Left to right is ggplot2's `check_overlap` for data in screen order. The
  screen emits a `FloatingText` per label with a text-shadow halo in the
  surface colour; the export emits `SvgHaloText`, a stroke in the surface
  colour under the glyphs; both are display-ui's, and the canvas feature
  labels and the arc labels' export emit through them too, so a floated
  label's typography is one declaration. What each display places stays its
  own: canvas's `labelPositioning.ts` moves onto this rule only on a bench at
  parity, as the handoff said.
- **The default colour is the theme's text colour.** A slot equal to its
  default leaves the config snapshot, so `TextMarkEntry.ownColor` says whether the
  config wrote the mark's colour; a text mark whose colour is unwritten prints
  in `palette.text.primary`, the way ggplot2's `geom_text` and GenomeSpy's
  `text` print black, and a written constant, `jexl:` or scale wins. Every
  other mark's unwritten colour stays the mark blue.
- **A text mark moves nothing.** The point inset the axis and the points share
  is taken over the point marks drawing, with text marks beside them counted
  as neither bar nor point.

## Consequences

- A text mark walks every instance of its layer in each visible block per
  pan on the main thread, so the guide says a text mark wants a `maxBpPerPx`.
  Dense per-base text (sequence letters, MAF bases) stays on canvas and outside
  the layer, as the 2026-09-23 call said.
- The circular view samples the display's canvas for its ring, so a text
  mark's labels stay on the linear track.
- `MARK_RULES` reads `span-density-source`, `unpinned-span-ramp` and
  `value-beside-rows` over text as over span; a `text` channel on any other
  mark is `unread-channel`; `size` on a text is `unread-size`.
- `test_data/volvox/config_marks.json` carries `marks_text`, bars with each
  feature's name over them, which the shipped-config tests read.
- ADR-106's Text bullet and ADR-110's label clause carry an amendment naming
  this record. GRAMMAR_OF_GRAPHICS.md's "Where a proposal lands" admits a
  layer beside a shape as what a new channel needs.
- No migration: a config never spelt `text` before.

## Rejected alternatives

- **A `text` channel on bar, point and span, labelling the mark itself.**
  Reuses each shape's ink for the anchor and keeps the mark list whole, and is
  how no grammar spells a label: Vega-Lite and GenomeSpy authors reach for
  `mark: text`, and ADR-159 chose their keys.
- **A `MarkShape` with an empty pass.** Keeps the list aligned by index at the
  cost of a shape that draws nothing on two backends, which the cross-backend
  gate and `sweepMarkAgainstHit` would then hold to a painter that paints
  nothing.
- **The mark blue as the default label colour.** A label that flips under a
  bar of the same blue is a halo and nothing else, and blue on dark paper is
  the weakest pair in dark mode.
- **Culling in instance order.** Instance order is genomic order, which a
  reversed block shows right to left, so two blocks would cull in opposite
  screen directions.
