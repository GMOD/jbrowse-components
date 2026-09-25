---
status: Accepted
summary: "A `span` instance's `row` lane is a stable row KEY, and the pass binds a two-plane RGBA8 row table the vertex stage samples — key to drawn slot or hidden, and a colour override — so a reorder, focus, hide or recolour uploads one small texture and no instance bytes, the way a y domain rides a uniform. `buildRowTable` writes the texels where the shader's lifted twins put them, `RowKeys` assigns each row name a key at its first arrival and never moves it, the painter, the ink and the hit test read the same table, and a pass binding no table draws `row` as the slot. The multi-row feature display adopts it: its encode runs once per region arrival, a category toggle is the one thing that still re-encodes, and the gated volvox fixture keeps a focus. The mark display waits for stage 2, since its bar and point marks spend their one sampler on the ramp. Measured: a reorder at 1000 rows and 500k features moves from 10.7 ms and 7.8 MB per region to 0.22 ms and 7.8 KB; a heavy focus costs a frame what the unfocused draw costs (6.6 vs 6.9 ms at 500k instances on an Intel UHD 630), against 0.7 ms compacted, which is the alternative recorded"
---

# ADR-NNN: The row axis rides a table the vertex stage samples

## Status

Accepted (2026-09-24). Stage 1 of the row axis resolved on the GPU: the
mechanism in `@jbrowse/render-core`, the `span` shape reading it, and the
multi-row feature display driving it. Applies rule 3 of
[grammar-of-graphics-convergence](../handoffs/grammar-of-graphics-convergence.md)
— generality resolves before the loop, and a domain rides a uniform — to the
row axis, and closes §3 of
[wiggle-instance-records-carry-per-row-constants](../ideas/waiting-on-someone-else/wiggle-instance-records-carry-per-row-constants.md)
for the span pass. Builds on ADR-113 (a span's colour is packed in the worker)
and ADR-157/160 (the rows and their colours are one config object each).

## Context

Every row display baked the drawn row slot, and often the row colour, into its
per-instance records, so a reorder, a focus, a hide or a recolour re-packed
whole regions: the mark display's `facetRegion` rewrote and filtered every
lane per region, and the multi-row feature display re-encoded on
`rowIndexByValue` and `rowColorsByIndex`. Measured before this change on a
shared box at load 30 (`plugins/canvas/benches/rowTableRepack.bench.ts`,
`plugins/marks/benches/rowTableRepack.bench.ts`, min of 15 rounds, controls
0.82–1.38x), per loaded region:

| display, gesture             | 100 rows, 50k features | 1000 rows, 50k | 1000 rows, 500k  |
| ---------------------------- | ---------------------- | -------------- | ---------------- |
| multi-row reorder            | 1.7 ms, 781 KiB        | 2.6 ms, 781 KiB | 10.7 ms, 7.8 MiB |
| multi-row focus (half kept)  | 0.9 ms, 391 KiB        | 1.3 ms, 391 KiB | 7.1 ms, 3.9 MiB  |
| multi-row recolour (one row) | 1.6 ms, 781 KiB        | 1.8 ms, 781 KiB | 10.2 ms, 7.8 MiB |
| mark display reorder (bars)  | 1.1 ms, 977 KiB        | 1.1 ms, 977 KiB | 19.5 ms, 9.5 MiB |
| mark display focus           | 1.2 ms, 488 KiB        | 1.2 ms, 488 KiB | 17.2 ms, 4.8 MiB |

The bytes are exact; the times are the encode and the pack on one region, and a
whole-genome view multiplies both by the regions loaded. Wiggle's numbers are
in the idea doc: 45–250 ms of fill or 60–500 ms of line per region at 1000
sources.

What the HALs allow: a render shader binds one uniform block and at most one
combined `Sampler2D` (`RENDER_SHAPES`, `shader-codegen/bindings.ts`); the span,
variant, MAF and wiggle line and band passes bind no texture; vertex-stage
sampling ships (`barMark` samples its ramp there) and WebGPU binding visibility
follows the stages the reflected table names; a texture uploads only when its
identity moves. Uniform arrays are out — WebGL2's 16 KB block floor, the
WebGPU uniform ring's cost per block, and a scalar `uint[N]` crashing slangc's
WGSL backend (`colorPack.slang`) — and storage buffers are refused on the
render path.

## Decision

**A `span` instance's `row` lane is a key, and the pass binds a row table.**
`packages/render-core/src/shaders/rowTable.slang` is the module:
`rowTableLookup(table, key, keys, own)` answers a `RowPlacement` — hidden, the
drawn slot, and the colour — through two `SampleLevel` reads at texel centres,
never `Load`, which this slangc emits as invalid WGSL. The texture is RGBA8 in
two planes, one texel per key, keys wrapped onto further rows past
`ROW_TABLE_MAX_WIDTH` (2048, WebGL2's guaranteed floor). The slot plane holds
the slot's low 24 bits in rgb and alpha 255 where the key is drawn, 0 where it
is hidden; the colour plane below it holds the override with straight alpha,
alpha 0 meaning the instance keeps its own colour, on both backends. A key at
or past `keys` is hidden. `rowTableKeys` is −1 on a pass binding no table,
and the lookup then answers the identity — `row` as the slot, the instance's
colour — so every other span consumer draws as it did. A hidden instance's six
vertices collapse onto one point off clip space, the fold `read.slang` uses
for a capless read.

**The TS side reads the shader's own layout.** `rowTableWidth`,
`rowTablePlaneHeight`, `rowTableTexelX` and `rowTableTexelY` are `//! js-export`
twins, and `buildRowTable(slot, color)` (`marks/rowTable.ts`) writes each
key's bytes where they say; `rowTable.test.ts` walks the bytes for the one
texel written at keys 0, 2047, 2048 and 5000 and holds it to the twins. The
result is one `RowTable` — `keys`, `slot` (`HIDDEN_ROW` where hidden),
`color` (`NO_ROW_COLOR` where none) and its `texture` — that the shader, the
painter, the ink and the hit test all place a key through. The span shape
declares `texture(params)` as `params.rowTable?.texture`, a new `MarkShape`
member: a shape whose texture is its own concept binds it off the params the
painter reads, so the two backends cannot be handed different tables. It
binds after the gates, inside `drawRegion`, through the `TextureBinder`
(`MarkTextureBinder`) the backend hands `drawMarks`, and the backend skips its
own pre-block bind for such a mark (`texturedByParams`). The pass samples
`nearest`, so the read-back is the byte the builder wrote.

**`RowKeys` assigns a name its key at first arrival and never moves it.** A
region encoded against the registry stays valid as later regions add names;
the table alone follows the reader's order, focus and colours. Keys are per
display, held in a `.views` closure beside the encode memo.

**The multi-row feature display drives it.** `buildMultiRowChannels` takes
`{ rowKeys, overriddenRows, hiddenColors }` and writes each feature's key and
baked colour once per region arrival, bucketing the hit test's channel
indices by key; `rowTable` is a computed off the drawn order, the row colours
by slot and the names seen, rebuilt on a reorder, focus, recolour or a new
name; `renderState` carries it and the mark's params lens hands it to the
shape. The hit test walks the drawn rows under the pointer, names each row's
key through the registry, and answers a hit's `rowName` off the key. A
category toggle still re-encodes, since which features the buffer holds
changes. A row painting an override is exempt from the category hide, so the
first override a row takes while a category is hidden re-encodes too; a change
to an override's colour does not, and while no category is hidden the encode
reads no rows at all. `hiddenColors` and the override set are identity-stable
in name and colour order, since the structural comparer walks a Set in
insertion order and a reorder would move it. The overlay that draws indel
glyphs, the sort at a column and the legend keep reading drawn row space
through `featurePaintInputs`; `hiddenByCategory` is the one spelling of the
exemption they and the encode share.

**The mark display stays as it is.** Its `rows` draw bars and points, whose
one sampler is the colour ramp, and a mixed mark list would keep
`facetRegion` rewriting the bar lanes on every reorder, so no gate there could
pass. Its transport — a second texture binding in both HALs, or the ramp and
the table in one texture — is stage 2's decision. The bench of its cost today
stays as the baseline.

**A hidden key's instances stay in the buffer.** `plugins/canvas/benches/rowTableFrame.probe.ts`
draws the span pass's own GLSL on a bare WebGL2 context, 1000 rows and 500k
instances, 10 rows kept, 30 interleaved frames, on this box's Intel UHD
Graphics 630 through ANGLE:

| arm                                       | instances | min    | median |
| ----------------------------------------- | --------: | -----: | -----: |
| every row drawn                           |   500,000 | 6.9 ms | 7.6 ms |
| control                                   |   500,000 | 6.9 ms | 7.9 ms |
| focus through the table, hidden collapsed |   500,000 | 6.6 ms | 7.4 ms |
| focus compacted to the kept rows          |     5,000 | 0.7 ms | 0.9 ms |
| no table bound                            |   500,000 | 6.8 ms | 7.2 ms |

A heavy focus costs a frame what the unfocused draw already cost: the
integrated GPU is vertex-bound on this pass, and a collapsed instance still
runs its vertex stage and one texel fetch. On SwiftShader at 100k instances
the same arms read 1878, 999 and 13 ms, the CPU rasterizer's vertex bill. At
the display's usual scale (tens of thousands of features a region) the
difference is a fraction of a millisecond; at the extreme it is ~6 ms a frame
on an integrated GPU after a focus, against a re-encode and re-upload of every
region on the focus itself (7 ms and 3.9 MiB a region at 500k). The table is
taken for focus too: one mechanism, an instant focus, and a pan after it no
dearer than the pan before it. The compaction is the recorded alternative
below.

## Consequences

- A reorder, focus or recolour on the multi-row display is one texture upload
  of `2 × keys` texels and zero instance uploads
  (`rowTableUploadSchedule.test.ts` on the mechanism,
  `featurePaintInputs.test.ts` on the display, the work census's
  `MultiRowRowTable` column). After: 0.06–0.26 ms and 0.8–7.8 KiB per gesture
  for the whole display, against the per-region numbers above, with the
  painted rects identical as a multiset on every gesture (the bench's identity
  check).
- The `span` contract is backward-compatible: `rowTable` is an optional param,
  `SpanChannels` is unchanged, and a pass without a table is pixel-identical
  (`spanMark.test.ts`, "an identity table paints what no table paints", and
  the no-table arm of the probe). MAF's port onto `spanMark` needs nothing.
- The span pass is now textured: a mark naming no table binds the inert ramp
  once, as `pointMark` does for Manhattan.
- `sweepMarkAgainstHit` sweeps the span through a reordered and a hidden row,
  through `sliceOne` since a hidden instance paints nothing
  (`drawAgainstHit.test.ts`). The sweep is Canvas2D against the hit test; GPU
  parity is the browser cross-backend gate, whose gated multi-row fixture
  (`misc-multirow-arranged`) now keeps a focus so a hidden row is in scope.
- The multi-row encode keys nothing on the order or the colours any more:
  `encodeInputs` replaces `featurePaintInputs` as the memo's inputs, and
  `MultiRowRenderState` carries `rowTable`. The overlay and the sort still
  read drawn row space. Net change: +437/−206 lines over ten files of the
  display, tests included, and +700/−50 over fifteen of render-core, the
  generated shader text included.
- Hidden instances stay resident on the GPU and in the encoded map.

## Stage 2

- **Bar, point and wiggle fill and density** bind the ramp. Either both HALs
  take a second combined sampler (the codegen's `RENDER_SHAPES`, the WebGPU
  layout from the reflected table, WebGL2's second unit, `uploadTexture` by
  slot, `MockHal`), or the ramp and the table share one texture with the ramp
  on row 0 and `rampColor` sampling `0.5 / height`. With either, the mark
  display keys its `rows` layers at arrival through `RowKeys`, its `rowsLayout`
  becomes a table, and `facetRegion` stays for `facet`, whose sections are of
  variable height.
- **Wiggle's line and band** passes bind nothing and read `rowIndex` per
  instance, so they take the table as span did; density draws off the fill
  buffer and waits for the fill.
- **Variants' cell and matrix** and **MAF's rows** bind nothing; their row
  lanes become keys and their models grow a table off `rowDomain`.
- A display whose frame scaffold draws through `drawPlannedPasses` binds no
  shape texture, since a plan carries no lens; it binds the table itself.

## Rejected alternatives

- **Compacting the buffer on a focus while the table carries order and
  colour.** Measured above: 0.7 ms a frame against 6.6 at 500k instances on
  an integrated GPU, at the price of a re-encode and re-upload of every region
  on each focus and a second place a hidden row is decided. Revisit with a
  workload that pans a focused view at that scale, or with a HAL draw taking
  an instance range, which would draw the kept keys' bucket without
  repacking.
- **A uniform array of slots.** WebGL2 guarantees a 16 KB block, so a 4-byte
  slot per row tops out near 4,000 rows with nothing else in the block; the
  WebGPU ring rewrites the largest block any pass binds per block per frame;
  and a scalar `uint[N]` crashes slangc's WGSL backend.
- **A storage buffer.** Refused on the render path (`RENDER_SHAPES`).
- **`Sampler2D.Load`.** Emits `textureLoad` on the sampler variable, invalid
  WGSL with this slangc.
- **The mark display in this stage, through a mixed row space.** Bar and
  point lanes would still be rewritten per reorder, so `rpcDataMap` moves and
  the zero-upload gate cannot pass; span layers alone would be a second row
  space beside the first.
- **A display lens for the table beside the params lens.** Two lenses naming
  one object let a display forget one and draw differently per backend; the
  shape binding its own texture off the params it paints from cannot.
