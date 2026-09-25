---
name: wiggle-instance-records-carry-per-row-constants
description: Measured 2026-09-17 at 1000 sources on real BigWigs. The 256MB buffer ceiling only bites in a BigWig's raw section, where bbi returns up to 9 features a pixel, so synthetic zoom tiers below the first real one were the biggest lever (7.8x fewer features on an FST scan) and landed as ADR-129. Summary tiers already stay under 2 a pixel, so per-pixel decimation buys nothing there. The step-line and center-line records are split (2026-09-17, 44 to 32 and 36 bytes), but the prototype's 40% faster encode came from literal word offsets, not the smaller record. A per-row colour texture shrinks every record by 4-8 bytes and turns a recolour into an 8KB upload, but the density LUT slot is taken and `Sampler2D.Load` emits broken WGSL. A positive-only specialisation isn't worth building, and ADR-016's split costs 57-85ms and doubles the wire bytes on signed data.
---

# Wiggle instance records carry per-row constants

A 2026-09-17 investigation into the memory and encode time of wiggle's GPU
instance buffers, measured on branch `wiggle-buffer-investigation`. The starting
question was whether strictly positive wiggles pay for the pivot/bicolor
machinery. The answer is no, and the investigation found bigger levers along
the way.

## The harness

`plugins/wiggle/benches/instanceBuffer.bench.ts` runs the real path: BigWig
arrays through `processFeaturesFromArrays`, `buildSourceRenderData` and the
production packers. The prototype packers in `prototypePackers.ts` run beside
it, and no shader draws them. Before it prints any time, the bench checks every
prototype field against the production buffer, colours included, through a
per-row table built from `gpuProps`. `runInstanceBufferScenarios.sh` runs the
six scenarios below. `benches/results/*.json` holds the re-run after #2 landed,
with production step and center arms. The raw output behind the tables below
is those files at 612b15c4be.

```
SCRNA=/path/CD4_T.bw FST=/path/fst_scan.bw \
  bash plugins/wiggle/benches/runInstanceBufferScenarios.sh out/
```

Setup: node 24, i9-9880H, 1000 sources and one 1500px screen per region. Each
source cycles one file's arrays. Each run takes the MIN over 15 rounds, with
the arms in a random order and a forced GC before each arm. Canvas2D arms use
node-canvas (cairo), not Chrome. The load average sat at 7-10 on a shared box,
and byte-identical controls landed up to ±35% off their baseline. **The byte
counts are exact, but treat any encode delta under ~25% as unresolved.** The
harness behind eeaabfbb46's "4300 features/source at 1Mb" was never committed,
so this one is a rebuild.

`--sign=signed` subtracts the median and `--sign=positive` takes |score|, so
signed and positive runs compare on identical geometry.

## Where the features-per-pixel actually is

bbi picks the highest level whose reduction is at most 2 x `basesPerSpan`, and
`basesPerSpan` is `bpPerPx x resolutionMultiplier`. `tierSpanRange` states the
same rule. On any summary tier of a dense file, then, a screen holds between
0.5 and 2 features per pixel. The measurements agree: phyloP 1.90-1.93/px at
the top of each tier, scRNA coverage 0.3-0.9/px. The raw section, below
`firstTier / 2` bp/px, has no such cap:

| file, bp/px | tier | features/px | features/source |
| --- | --- | --- | --- |
| scRNA CD4_T coverage, 151 | raw (first tier 304) | 2.99 | 4,492 |
| phyloP BRCA1, 4.9 | raw (first tier 10) | 4.67 | 7,011 |
| 1KG FST scan, 319 | raw (first tier 640) | 9.31 | 13,966 |
| scRNA CD4_T, 667 (the 1Mb view) | 1216 | 0.51 | 763 |

A 1500px screen tops out near 3,000 features a source on a summary tier. The
commit's 4,300-at-1Mb was therefore raw-section data or a wider canvas.

## Measurements

1000 sources, one region. Sizes are MiB, so the 256MB `maxBufferSize` floor is
256 on this scale.

| scenario | fill 20B | fill 16B* | line 44B | step 32B | step 24B* | center 36B | center 28B* | band 44B | band 36B* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| scRNA raw 151 bp/px | 85.7 | 68.5 | 188.5 | 137.1 | 102.8 | 154.2 | 119.9 | — | — |
| FST raw 319 bp/px | **266.4** | 213.1 | **586.0** | **426.2** | **319.7** | **479.5** | **372.9** | — | — |
| phyloP tier 40, 79 bp/px | 55.2 | 44.1 | 121.4 | 88.3 | 66.2 | 99.3 | 77.3 | 121.4 | 99.3 |
| scRNA 1Mb, tier 1216 | 14.6 | 11.6 | 32.0 | 23.3 | 17.5 | 26.2 | 20.4 | 32.0 | 26.2 |

\* needs the per-row colour table. Bold means over the floor: today the FST
scan cannot draw even xyplot at 1000 sources.

Pack time in ms, MIN of 15. The control arm calls the baseline through a
second driver.

| scenario | fill / ctrl / 16B | step 44 / ctrl / 32 / 24 | center 44 / 36 / 28 | band 44 / 36 |
| --- | --- | --- | --- | --- |
| scRNA raw, positive | 64 / 70 / 59 | 138 / 137 / 84 / 86 | 159 / 158 / 110 | — |
| scRNA raw, signed | 87 / 84 / 46 | 173 / 172 / 92 / 81 | 184 / 163 / 132 | — |
| FST raw | 249 / 226 / 187 | 431 / 437 / 258 / 217 | 515 / 501 / 397 | — |
| phyloP, signed | 45 / 44 / 34 | 130 / 108 / 85 / 59 | 133 / 114 / 100 | 129 / 104 |
| phyloP, positive | 50 / 52 / 45 | 98 / 98 / 58 / 60 | 115 / 95 / 84 | 111 / 95 |
| scRNA 1Mb | 9 / 11 / 12 | 28 / 30 / 9 / 8 | 33 / 18 / 15 | 39 / 19 |

`buildSourceRenderData` itself costs 0.3-1ms. The packers are the encode time.
Every prototype column (fill 16, step 32/24, center 36/28, band 36) writes
literal word offsets where the production packers read generated offset
objects, which #2 found is worth 20-40% by itself, so these deltas overstate
what the smaller records buy.

Worker time, `processFeaturesFromArrays` over 1000 sources, in ms:

| scenario | bicolor | control | useBicolor=false | wire+retained MiB (bicolor / not) |
| --- | --- | --- | --- | --- |
| scRNA raw, positive | 24 | 32 | 22 | 51.4 / 51.4 |
| scRNA raw, signed (47% neg) | 89 | 87 | 32 | **102.8** / 51.4 |
| phyloP, signed (47% neg) | 117 | 109 | 32 | **88.3** / 55.2 |
| phyloP, positive | 35 | 37 | 38 | 55.2 / 55.2 |
| FST raw, positive | 107 | 110 | 89 | 159.8 / 159.8 |

## Candidates, ranked

### 1. Synthetic zoom tiers below a BigWig's first level — taken

[ADR-129](../../architecture-decision-records/adr-129-a-bigwigs-raw-section-answers-in-synthetic-tiers.md)
has the design, the measurements and the rejected variants. The FST scan at
319 bp/px now reads 1,783 rows a source instead of 13,966, which is 34 MiB of
fill at 1000 sources instead of 266. Two things came out differently from the
sketch this section held before. A file keeps a bin only where it is at least
twice its mean record span, so coarse data isn't binned. And a row spans the
bases its bin covers, not the whole bin.

### 2. Separate step-line and center-line records — done

**Landed 2026-09-17** on branch `wiggle-line-records`. `wiggleLine.slang` draws
the step line on 32 bytes and `wiggleLineCenter.slang` the center line on 36,
with a buffer of its own instead of borrowing the step line's through
`bufferOf`. `rowScoreToYPx` and `pivotSideColor` moved into `wiggleCommon`, so
both lines and the band still place and colour a score through one function.

**Bytes, exact:** step 44 → 32 (-27%), center 44 → 36 (-18%), as predicted.
The per-source ceiling moves from 6,100 features to 8,388 (step) or 7,456
(center). FST raw at 1000 sources: 586 → 426 MiB step, 480 MiB center. Both
still exceed the 256MB floor there, so #1 is still what lets that scan draw.

**Encode: the 40% did not survive.** Paired in one process on the same harness
(15 rounds, MIN, random order, GC before each arm), main's 44-byte packer
against the production 32/36-byte ones. Load average 5-12, so the ±35% caveat
above holds:

| scenario | step 44 / ctrl / 32 | center 44 / ctrl / 36 | step 32 literal | center 36 literal |
| --- | --- | --- | --- | --- |
| scRNA raw, positive | 119 / 122 / 116 | 135 / 139 / 139 | 83 | 116 |
| scRNA raw, signed | 123 / 124 / 123 | 146 / 147 / 155 | 86 | 115 |
| scRNA 1Mb | 18 / 25 / 13 | 19 / 19 / 27 | 8 | 16 |
| phyloP, signed | 78 / 76 / 70 | 90 / 92 / 100 | 46 | 74 |
| phyloP, positive | 76 / 75 / 69 | 87 / 87 / 99 | 55 | 71 |
| FST raw | 392 / 411 / 350 | 500 / 515 / 439 | 225 | 437 |

Step reads 0-11% faster, inside noise (28% at 1Mb, where the control sat 39%
off its baseline). Center moves both ways. The prototype arms above
(`packStepLine32`, `packCenterLine36`) wrote **literal** word offsets, and the
production packers read the generated `INSTANCE_OFFSET_*` objects. The two
produce byte-identical buffers, and the literal version alone is 20-38% faster
on the step line and 0-41% on the center line. Destructuring the offsets into
locals before the loop recovered only 5-15%. So the encode lever is how the
packers address the record, not how big it is, and it applies to all four
packers. The generated `packInstances` already writes literals but takes one
array per field. Unmeasured.

### 3. A per-row colour table (texture), and shader-side sign colouring

**Gain in bytes:** fill 20 → 16, step 32 → 24, center 36 → 28, band 44 → 36,
counted on top of #2. Fill cannot reach 12, because `rowIndex` stays per
instance: 1000 sources in one draw call have no other way to name their row.
The prototype packs `row << 1 | side` into one word.

**Gain in interaction:** colour is in `gpuProps` (`sources[].color` and the
resolved `wiggleColor` pair), so a colour change today re-encodes every loaded
region. That costs 45-250ms of fill or 60-500ms of line per region at 1000
sources, per the tables above. A table makes it one 8,000-byte texture upload.
A sort or subtrack toggle still re-encodes unless the instance carries the
payload's source index and the table also maps index → row and visibility. The
cost then moves to hidden sources staying in the buffer.

**What the HAL supports today:**

- A pass gets one texture. `pnpm gen:shaders` refuses a second sampler. Fill,
  line and band bind none, so they are free.
- **Density is not free.** Its ramp LUT holds the slot, and it draws off the
  fill pass's buffer (`bufferOf: fill`), so removing `color` from the fill
  record removes it from density too. Density then needs the ramp and the row
  table in one texture (row 0 the ramp, row 1 the colours), or multi-texture
  support in both HALs.
- The WebGPU bind group layout shows each binding to the stages the shader's
  reflected table says read it (`bindGroupLayoutEntries`, `deviceGpuCache.ts`),
  so a vertex-stage lookup needs nothing of the HAL: `barMark` samples its
  ramp in the vertex stage, and the span pass samples its row table there
  ([ADR-165](../../architecture-decision-records/ADR-165-FILE)).
- **`Sampler2D.Load` emits invalid WGSL** with this slangc: `textureLoad` on the
  sampler variable. `SampleLevel` at the texel centre with a `nearest` binding
  compiles to `textureSampleLevel` and `textureLod`, both of which work. Found
  by compiling a probe shader, not by drawing one.
- The texture's max dimension is ≥8192 on WebGPU. WebGL2 guarantees 2048, so
  the row table wraps keys onto further rows past `ROW_TABLE_MAX_WIDTH`.
- **The table exists.** `packages/render-core/src/marks/rowTable.ts` and
  `shaders/rowTable.slang` are the two-plane key → slot, hidden, colour
  texture the span pass reads and the multi-row feature display drives
  (ADR-165). Wiggle's fill and density passes take it once a second
  texture binding lands in both HALs, or the ramp and the table share one
  texture; the line and band passes bind nothing today and can take it as
  span did.

**What kills the uniform-array version:** WebGL2 guarantees a
`MAX_UNIFORM_BLOCK_SIZE` of only 16,384 bytes, and std140 pads each array
element to 16. Two colours per row in a `uvec4` then cap out near 1,000 rows,
and wiggle's shared block already takes 80. On WebGPU the uniform
ring is `MAX_UNIFORM_SLOTS` (2048) x the largest block any pass binds, rewritten
per block per frame, so a 16KB block costs ~33MB of ring per HAL. Spec limits,
not measured on hardware.

**Pairs with #4.** Once the shader picks `table[row][score >= origin]`, the
avg-path pos/neg split has no GPU consumer left. The line and band shaders
already colour by side.

**Cost and risk:** medium. The table, its shader module, the shape-side
binding and the Canvas2D reading of it landed with the span pass
(ADR-165); what is left here is four wiggle shaders reading it, density's
second texture, and the painters reading the table where they read
`source.color`. Whiskers scatter's per-instance tints (`colorsAbgr`) need a
band index in the row word, or they keep a colour lane.

### 4. ADR-016, re-measured: don't move the split, delete it — landed

**Landed 2026-09-19.** The worker no longer partitions, the six `pos*`/`neg*`
fields are off `WiggleFeatureArrays`, and the colour settings left `rpcProps`
for `gpuProps` alone. ADR-144 then folded the six spellings this section
measured into one `color` object and renamed the pivot `origin`; the arms below
kept the names they were run under. The main thread colours by sign per instance
through `bandColorsAbgr`, which the whiskers bands already used, so every mode
now partitions the same way and density keeps the solid layers `drawDensity`
needs. The measurements below are what the deletion was taken on; they stand.

On signed data the split cost the worker 57ms (scRNA: the worker 57ms (scRNA:
89 vs 32) to 85ms (phyloP: 117 vs 32) at 1000 sources. That is about the same
as packing the region's fill buffer. It also doubled what the region ships and
what `rpcDataMap` retains on the main thread: +51 MiB and +33 MiB. On
one-sided data it cost nothing measurable, and aliasing kept the wire bytes
identical.

Moving it into `buildSourceRenderData` as the parked idea proposes puts those
57-85ms on the main thread per region arrival. Under `createEncodeMemo` the
split also re-runs on every `gpuProps` change (colour, sort, plot type) unless
it gets its own memo. ADR-016's rule already names the better exit: work
"expressible as a uniform". `origin` is already a uniform, so with #3 the GPU
colours by sign and the split disappears instead of moving, and a change to the
cut costs no refetch and no re-encode.
**Unmeasured risk:** Canvas2D xyplot would then switch `fillStyle` by sign
inside one layer. On phyloP-like data (47% negative) that means roughly one
switch per two bins, and density's per-layer gradient needs both sides. A
Canvas2D-only lazy split is the fallback.

### 5. Positive-only specialisation: not worth building

- **Worker:** bicolor vs `useBicolor=false` on positive data sits inside the
  control's spread in all three positive scenarios (24/22 against a 32
  control; 35/38; 107/89 against 110). The count loop is one pass, and
  aliasing ships nothing extra.
- **GPU bytes:** only the line and band records spend 4 bytes (9%) on
  `negColor`, and #3 removes that for every track, not just positive ones.
- **GPU fragment:** one compare and select in `pivotSideColor`. Not measured,
  since node has no GPU. Nothing suggests it shows.
- **Canvas2D:** with default colours `strokeBySide` walks a positive track
  twice. Against a no-op context, the empty second walk costs about as much JS
  as the first: +20ms per 100 rows (scRNA), +35ms per 30 rows (FST). Real
  painting through node-canvas moved within ±3% of the single-colour arm
  (922/913, 1507/1447, 697/688ms), because stroking dominates. Chrome may weigh
  it differently. Skipping the `below` pass for a layer with no score under the
  pivot costs a few lines, for a gain that stays small.

### 6. Same pattern elsewhere (quick survey, byte counts, not audited)

An agent read the packers, and only the first row was spot-checked by hand
(`computeVariantCells.ts` repeats one variant's span on every sample's cell).

| record | stride | repeated per-row/feature constant | share |
| --- | --- | --- | --- |
| multi-sample variant `CellInstance` | 20 | startEnd + shapeType per variant, on every sample's cell | 60% |
| variant matrix `CellInstance` | 12 | featureIndex per column | 33% |
| synteny ribbon (4 pipelines) | 32 | alignmentLength, color per feature (+ featureId, kind) | 25-50% |
| Manhattan `PointMarkInstance` | 24 | row always 0, glyph default outside LD | 33% |
| MAF / multi-row `RowRectInstance` | 16 | row (and row colour when set) | 25-50% |
| dotplot | 20 | color per feature | 20% |
| alignments `gap` / `clip` | 20 / 16 | gapType constant per buffer; kind in two runs | 20-25% |
| pileup read | 44 | tagColor 0 when unused; six small fields in 4-byte words | 9% (+~40% by packing) |

The variant cell is the biggest: 1000 variants x 3000 samples is the scale its
own comments cite. A per-variant span texture needs exact u32 through RGBA8,
which works but is the same HAL work as #3.

## Order if taken

#1, #2 and #4 have landed (#1 as ADR-129, #4 as the split's deletion). #3 is
what is left, and it now stands alone rather than pairing with #4: the deletion
leans on the per-instance colour lane a per-row colour table would take away,
so the table has to arrive with shader-side sign colouring for the xyplot and
scatter families, not only for the lines. Settle density's texture first.

## 2026-09-19: #3 is also what the mark grammar needs

[ADR-152](../../architecture-decision-records/adr-152-wiggle-stays-off-the-column-encoder-until-two-lanes-go.md) benched a column encoder
against this file's own path and found the time free and the bytes not: an
`EncodedChannels` retains 20 bytes a feature where `processFeaturesFromArrays`
retains 12, four of them a `featureIndex` that is the identity permutation and
four a per-instance colour lane. #3's per-row colour table is the second of
those met from the GPU side, so the two proposals now share a condition rather
than sitting in different subsystems, and the FST-raw scenario this file
measured is the one the verdict's `multi-wiggle` row is shaped after.
