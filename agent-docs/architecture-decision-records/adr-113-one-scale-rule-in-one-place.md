---
status: Accepted
summary: "A scale is declared on the channel it scales and resolved wherever it is cheapest, and both halves of that rule now hold: `encoding.y` carries `{ field, scale, domain }` and `ScoreScaleMixin` resolves it rather than owning a second copy, so the score menu edits the declaration; and a quantitative colour ramp resolves on the main thread against a domain unioned over the loaded regions, read by the shapes as a uniform plus the shared LUT, so an unpinned ramp agrees across regions and a pan uploads no instance bytes. The ramp rides the existing colour lane reinterpreted, not a new one; `span` keeps the worker-resolved colour, and a bin width that follows the zoom stays declined here (taken in ADR-117)"
---

# ADR-113: One scale rule, in one place

## Status

Accepted (2026-09-10). Closes the two seams
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) named — "the
scale lives in two places" and "a scale table is per fetched region" — the
first for the mark display, the second for the quantitative colour channel.
Amends [ADR-107](adr-107-the-quantitative-class-is-authored-in-config.md)'s
consequence that "a ramp table is per region without a `domain`", and rests on
[ADR-095](adr-095-a-shape-composes-a-scale-at-compile-time.md)'s compile-time
composition and [ADR-097](adr-097-the-y-channel-shares-its-scale-and-not-its-anchor.md)'s
scale/anchor split, neither of which is reopened.
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) is the operational doc.

## Context

A config reader met two spellings of the same idea. A colour scale sat on the
channel — `{ field, scale, domain, palette | ramp }` under `encoding.color` —
and the value scale did not: `encoding.y` was a bare field name and the axis
it was read through lived four levels away, as `minScore`, `maxScore` and
`scaleType` on the display. Nothing said so at either site, and a reader who
found `scale` under `color` had no reason to think the y channel had one.

The second seam was where a scale resolves. A categorical colour resolves in
the worker and travels packed with the instance, which is right: the value
decides the colour and the colour is data. A quantitative one did the same and
should not have, because its domain is not a property of the region — it is
the extremes of every region loaded, and it moves when the next one arrives.
Each region resolved its own table, so the same value painted two colours in
two blocks of one view and the legend could only show one of them. That is the
problem the y axis had already solved: `valueScale.slang` reads a domain
uniform, so an autoscale that moves costs one 64-byte write and no buffer
(ADR-095 Gate A).

## Decision

**A scale is declared on the channel it scales, and resolved wherever that
channel's cost says.** Two changes, one rule.

### `encoding.y` carries the value scale

`MarkEncoding.y` is `ValueEncoding` — a field name, or `{ field, scale?:
'linear' | 'log', domain?: [min, max] }` — and `marks[].encoding.y` is the
matching typed sub-schema (`field`, `scale`, `domain`, never `frozen`), with a
`preProcessSnapshot` lifting the bare string into `field` so `y: 'score'`
keeps working and keeps its defaults.

`ScoreScaleMixin` becomes the resolution rather than a second owner. It gains
one overridable hook, `declaredValueScale`, default undefined; where a display
answers it, `scaleType` reads the declared type and `manualMinScore` /
`manualMaxScore` read the declared bounds, falling through to the
`scaleType`/`minScore`/`maxScore` slots for what the declaration leaves open.
Wiggle, the multi-wiggle, Manhattan and the alignments coverage band answer
nothing and are untouched — their axis IS those slots, and this ADR does not
move them.

`LinearMarkDisplay` answers the hook off **the first mark drawing at this zoom
whose `y` names a field**. Every mark shares one y (ADR-112), so one
declaration has to be the shared one, and the first drawing one is the rule —
which is also what makes a multiscale pair coherent, since the density mark
and the feature mark are never both drawing.

**The track menu edits the declaration.** `setMinScore`, `setMaxScore` and
`setScaleType` write into the owning mark's `encoding.y` rather than the
display's own slots, so a pin the user sets and a pin the config author wrote
are the same slot and there is one owner. `domain` is a two-entry list with an
empty entry meaning "autoscale this end", which is what lets the menu pin one
bound; both empty is written as `[]`, so "Clear manual min/max" leaves no
residue. A display whose marks declare no `y` field falls back to the slots.

The declared scale does **not** cross the wire. The worker reads a value; the
scale it is read through is the display's, and shipping it would put the axis
type and its bounds into the fetch's inputs, so a menu toggle between linear
and log would refetch every region to no effect. `valueField` is the one
reader of either form.

Log placement is real, not a label: `valueScale.slang` gains
`valueToYPxScaled`, whose log arm is `scoreScale`'s `normalizeScore` — the
normalizer wiggle and the coverage band are already placed by — and whose
linear arm is the existing `valueToYPx`, unchanged, because the two disagree
on a degenerate domain and that difference is a pinned cross-backend value
(ADR-097). `computeYTicks` already took a `scaleType`, so the axis and the
shader now read one declaration.

### A quantitative colour ramp resolves on the main thread

`LaneName` gains `colorValue`. A caller that names it and declares a
`linear`/`log` colour gets the **raw values** and the region's own `extent`,
and no packed colours; a caller that names only `color` gets today's
worker-resolved lane. Which side of the wire a ramp resolves on is the
caller's lane choice, which is the tree's existing "a lane is filled because a
shape reads it" rule pointed at a scale.

The display unions the regions' extents into one domain — the same union the
legend already did for a categorical table, extended to the ramp — and hands
it to the shapes as `MarkRamp { domain, scale, lut }`. `bar` and `point` read
it as three uniforms (`rampMode`, `rampMin`, `rampMax`) plus the 256-entry LUT
bound through `defineMark`'s `texture` hook, the mechanism ADR-095 built and
`createMarkBackend` already drives. `markColor.slang` is the one module both
shapes compose for it, and it calls `scoreScale`'s `normalizeScore`, so a
ramp's domain is read exactly as the axis reads y's.

**The ramp rides the colour lane, reinterpreted.** One 4-byte instance slot
carries either the packed ABGR or the value's float32 bits, and `rampMode`
says which: `colorBits` views the encoder's `Float32Array` as the `Uint32Array`
the attribute declares, and the shader's `asfloat` undoes it. So a ramp costs
no instance byte and no second attribute on shapes that never use one.

The Canvas2D painters — which are also the SVG export — have no sampler, so
they bake: `paintColors` resolves the values against the domain once and
memoizes the packed array on the payload, keyed by the domain, the scale type
and the LUT's identity. A repaint at an unchanged domain — every pan, hover
and height drag — walks no values and the painters' fill batching still sees
runs of one colour.

The legend reads the unioned domain, and a pinned `domain` still pins: the
table says `pinned`, and a pinned ramp is every region's whatever they hold.

## The measured record

- **The encoder got cheaper, not dearer.** Shipping the values raw
  (`ramp-value`, 1.04x native) against resolving them per feature in the
  worker (`ramp-color`, 1.22x) is 305 → 259 ns per feature, and the whole
  table is in `reference/MARK_ENCODING.md` §"The jexl channel, measured". A
  ramp is now the cheapest declared scale the encoder has.
- **The Canvas2D repaint is unchanged in the steady state.**
  `packages/render-core/benches/markRampPaint.bench.ts`, 200,000 bars, min of
  25, on AC power: `packed` (the worker-resolved lane, what shipped before)
  45.16 ms; `baked` (the ramp with the domain unchanged since the last
  repaint) 45.41 ms, **1.01x**, against a separately-declared control at
  1.00x; `perPaint` (the domain moved every repaint, so the bake runs inside
  the frame) 48.83 ms, **1.08x**. So the bake is not a thing that had to be
  got right for speed — resolving the ramp every frame would have cost 8% of
  a repaint — and it is kept because a memo keyed on the domain is the honest
  shape and the SVG export walks the same painter. Absolute times drift about
  1.4x between runs on this shared box; the ratios held across three.
- **The GPU cost of a domain that moves is one uniform write**, structurally:
  `packInstances` takes no domain, `installUpload`'s cells carry none, and the
  ramp rides `renderState`, read per frame by the render autorun. The 1 KB LUT
  re-uploads only when its bytes' identity moves (`GpuMarkBackend.boundRamps`),
  which a pan does not do.
- **The per-frame main-thread work is a min and a max per loaded region**, in
  `buildMarkLegend`'s existing fold — no second pass over the values.

## Consequences

- A config reader sees a scale under `encoding.y` and under `encoding.color`,
  spelled the same way, and the display's `minScore`/`maxScore`/`scaleType`
  slots are what a mark display falls back to rather than what it means.
- An unpinned quantitative ramp now agrees across the loaded regions of one
  view. The honest limit that remains is the whole dataset: a value outside
  every loaded region has never been seen, so the domain still grows as the
  user pans, and `domain` is still what fixes a legend for a figure.
- `hasManualScoreBounds` answers yes for a mark display whose encoding pins a
  bound, so the menu's "Clear manual min/max" row appears and clears the
  declaration. That is the intended reading: the row asks about a pin, not
  about which file the pin is written in.
- The scale type stays config-only on the mark display, and its
  `setScaleType` writes the declaration for whoever reaches it. The shared
  radio offers symlog, which `MarkValueScale` does not admit and
  `valueToYPxScaled` does not place, so `makeScoreSubMenu`'s `scaleType:
  false` stands — the same opt-out Manhattan takes, for the same reason
  `scoreMenuItems.ts` states at the radio.
- A shape reading a ramp declares `color` and `colorValue` optional and asks
  `colorBits` for the GPU and `paintColors` for Canvas2D. `span` declares
  neither and keeps a required packed `color`.
- `MarkEncoding.y`'s object form has no in-tree producer on the wire, by the
  decision above. It stays part of `CoreEncodeFeatures`' declared shape,
  `encodeFeatures` reads either, and `valueField` is the reader.

## Rejected alternatives

- **A ramp on `span` too.** `span` is `rowRect`'s entry point and `rowRect`'s
  uniform struct is shared with four other consumers (multi-row, MAF, the two
  variant displays); a sampler and three uniforms on it would move all five
  for a channel no config asks for on a span, and `gen:shaders` checks those
  five lay out identically. A span's ramp keeps resolving in the worker, which
  is the `color` lane the encoder still fills.
- **A second instance attribute for the value.** Honest to read and 4 bytes
  per instance on every mark of every shape, ramp or not, against zero for the
  reinterpret. At the million-feature scale the encoder is measured at that is
  4 MB per region to describe a channel most marks do not have, and it
  contradicts the lane rule the encoder is built on.
- **The ramp stops as a uniform array instead of the LUT texture.** Viridis is
  256 stops; eight in a uniform is a different gradient from the one the
  Canvas2D twin and the legend index, and ADR-095's Gate C exists because the
  GPU/Canvas2D/SVG seam is where this tree's compositions actually break.
- **Resolving the ramp per instance in the painter, with no bake.** Measured
  at 1.03x a repaint (`perPaint` above), so it was not refused on cost. It is
  refused because the domain is the thing that changes and a memo keyed on it
  says so, and because the SVG export walks the same painter.
- **Unifying `valueToYPx`'s linear arm with `normalizeScore`'s.** They
  disagree on a degenerate domain by the full canvas height, and that value is
  pinned across backends (ADR-097, `scoreToYParity.test.ts`). The log arm
  composes; the linear one stays.
- **Shipping the declared y scale to the worker.** It would be read by
  nothing there and would key the fetch on the axis, so toggling linear/log
  from the menu would refetch every loaded region.
- **A per-mark y scale, so two marks could have two axes.** That is
  `resolve: { y: 'independent' }`, which GRAMMAR_OF_GRAPHICS.md still lists as
  a gap and which needs a second axis in the chrome. The declaration is
  per-mark because that is where the channel is; the resolution is the
  display's one shared scale, and the first drawing declaration wins.
- **A bin width that follows the zoom.** Declined here on ADR-112's terms —
  nothing in this ADR changes what a fetch is keyed on — and taken in
  [ADR-117](adr-117-the-density-tier-is-a-mark-layer.md), which does: the
  resolved width is a term of `rpcProps()`.
