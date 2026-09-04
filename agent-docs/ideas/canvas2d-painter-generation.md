---
name: canvas2d-painter-generation
description: Every pass on all 13 GPU renderers classified against the Canvas2D painter that draws the same mark, and the live remainder of the 2026-09-04 GPU architecture review. 45 distinct passes, 57 registrations: 38 are interpretable (Tier B), 2 transliterable-only, 5 never, so the mechanism is worth building — and the first conversion, the coverage band, landed 2026-09-04 and settled the struct-parameter question in favour of scalar cores. Read the honesty section first, because a third of the B rows carry a deliberate Canvas2D-only divergence a generated painter would erase, the alignments pileup already derives its painter from a mark declaration that B would compete with, and every piece of text on every display lives outside both backends and is untouched by any of this.
---

# Generating the Canvas2D painters: the census

Answered 2026-09-04 by reading, not running: the 13 `Gpu*Renderer.ts` pass
lists, every `.slang` they draw with, and the Canvas2D painter each pass lands
on. The threshold the GPU architecture review set was "if eight passes qualify,
build it; if two do, do not". The count is below, the recommendation at the end.

**This file is that review's live remainder.** Its other findings landed in
[reference/GPU_RENDERING.md](../reference/GPU_RENDERING.md) §"What this
architecture deliberately does not have" (indirect drawing, storage buffers,
depth/early-Z, draw-call merging, persistent staging, buffer pooling, GPU
picking, runtime shader generation, nested render scopes) and §"Keeping the two
backends in parity" (a hit test is a consumer of shader scalars too), in
`measurements/buffer-churn-pan.json`, and in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) (LUT-indexed
colour, compute-driven packing). The handoff itself is closed.

Vocabulary is the handoff's. **A** — transliterable functions only; the painter
calls `//! js-export`ed scalars and hand-writes the drawing. **B** —
interpretable; the painter reads the same packed instance buffer the GPU reads
through the generated `INSTANCE_OFFSET_F32` / `_U32` maps and per instance calls
transliterated functions for a rect and a colour. **C** — declarable; a
`//! canvas2d: fillRect(...)` directive names the exported functions that supply
the painter's arguments and the painter is generated. **never** — samples a
texture, or takes a derivative for something other than antialiasing.

## What the transliterator handles today

Read before the gap list, because most of the gaps are deliberate.
[`wgslToJs.ts`](../../packages/shader-tools/src/shader-codegen/wgslToJs.ts)
accepts `f32`/`u32`/`i32`/`bool` parameters and locals, `if`/`else`/`return`
and named locals, the arithmetic and comparison operators with signedness
tracked for the bitwise ones, and `vec2<f32>` **in return position only** as a
tuple. Builtins: `abs ceil exp floor log log2 pow sign sqrt trunc` map to
`Math.*`; `clamp mix step fract smoothstep max min` get NaN-faithful helpers.
Refused by name: `length dot cross normalize distance sin cos tan asin acos atan
atan2 inverseSqrt dpdx dpdy fwidth textureSample* textureLoad round
pack4x8unorm unpack4x8unorm` and the bit-count pair. Refused by construct:
vector parameters, locals, swizzles and arithmetic; `vec3`/`vec4`; struct
parameters (slangc emits them as `ptr<function, Uniforms>`) and struct returns;
indexing; loops and `switch`. Every refusal is a hard error at
`pnpm gen:shaders`; nothing is guessed
([ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)).

## The census

One row per pass registration. A pass registered by two renderers (the coverage
band on alignments and MAF; the synteny and canvas glyph passes on the multi-way
display) appears under each, marked _re-reg_, and is counted once in the
distinct totals. Blend is `default` unless the shader carries `//! blend:` or
the pass overrides it. "Painter reads" is whether the Canvas2D painter today
reads the packed instance buffer (**buffer**) or re-derives the marks from the
worker's parallel arrays or the feature records (**arrays**). "Draws with" is
the Canvas2D calls the painter actually issues.

<!-- prettier-ignore -->
| Renderer | Pass · shader | Shape modules | Blend | Painter reads | Draws with | Tier | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| alignments | `connLine` · connectingLine | hpmath, colorPack | default | arrays | moveTo/lineTo/stroke | B | 1 px row-centred quad, uniform colour; no AA, no fade. Canvas2D strokes what the GPU fills — SVG emits `<path>` where B would emit `<rect>` (see ideas/one-mark-declaration-per-feature §connectingLines) |
| alignments | `linkedReadLine` · linkedReadLine | capsule (frame only), antialias, hpmath, colorPack | default | arrays | lineWidth + moveTo/lineTo/stroke | B | oriented segment between two rows, analytic butt-cap AA only; colour is a uniform slot via exported `linkedReadColorSlot` |
| alignments | `read` · read | hpmath, colorPack | default | arrays | fillRect, pentagon path + fill, strokeRectInside | A | body rect + chevron cap is a Canvas2D path, but the colour is a uniform-array index (`readCategoryColor[colorCategory]`, `hueRampHalfSat` → `float3`) and the outline is a per-fragment rule; 11 fields, hand-tuned glyph. `showChevron` exported already |
| alignments | `overlap` · overlap | hpmath, colorPack | default | arrays | fillRect (`paintMarks` span) | B | full-row span quad, uniform colour, alpha from exported `overlapFade`/`overlapAlpha`; vertex fold at alpha 0 |
| alignments | `modification` · packedColorQuad | hpmath, colorPack | default | arrays | fillRect (`paintMarks` cell) | B | 1 bp cell via `pileupCellX`, per-instance packed ABGR; the purest fillRect in the tree |
| alignments | `perBaseQuality` · packedColorQuad | hpmath, colorPack | default | arrays | fillRect (+0.5 px seam fudge) | B | as `modification`; Canvas2D-only `PILEUP_CELL_SEAM_FUDGE_PX` on contiguous cells |
| alignments | `skip` · gap | hpmath, colorPack | default | arrays | fillRect (1 px band) | B | span via `expandMinWidthX`, collapsed to a centreline; uniform colour × exported `intronAlpha` |
| alignments | `deletion` · gap | hpmath, colorPack | default | arrays | fillRect | B | full-row span, uniform colour × exported `frequencyFadeGate`·`sizeAlpha` |
| alignments | `mismatch` · mismatch | hpmath, colorPack | default | arrays | fillRect (cell) | B | cell quad; colour is a `switch` over four uniform slots (`baseColor` → `float3`); alpha from exported `qualityFade` |
| alignments | `insertion` · insertion | hpmath, colorPack | default | arrays | fillRect bar + two triangle fills (`drawInsertionSerifs`) | B | three rects, one a centred bar of exported `insertionBarWidthPx`, two tapered serif wedges (`serifPos`, vec2 math); uniform colour. GPU draws the label BOX, never the digits |
| alignments | `clip` · clip | hpmath, colorPack | default | arrays | fillRect (1 px) | B | fixed 1 CSS px full-row bar on a bp edge, two uniform colours by `kind` |
| alignments | `softclipBases` · mismatch | hpmath, colorPack | default | arrays | fillRect (+seam fudge) | B | mismatch shader with fades neutralised at pack time |
| alignments | `perBaseLetter` · mismatch | hpmath, colorPack | default | arrays | fillRect (+seam fudge) | B | despite the name, neither backend draws a glyph here; the letters are the labels overlay |
| alignments | `coverage` · coverageBar | coverageBand, colorPack, hpmath (scoreScale) | default | **buffer** (`coverageLayout.generated`) | fillSpanRect → fillRect (+0.8 px seam fudge) | B | bar from the band baseline up by `covBarHeightPx`; uniform colour. Painter already reads the worker-packed buffer through the generated layout — **converted 2026-09-04**, and the row named `covBottom`/`covBarScale` before it |
| alignments | `snpCov` · coverageSnp | coverageBand, hpmath | default | **buffer** | fillSpanRect → fillRect | B | depth-bar slice; colour a `switch` over uniform base slots (`covSnpColor` → `float3`). Placement converted with the depth bar, 2026-09-04 |
| alignments | `modCov` · coverageMod | coverageBand, colorPack, hpmath | default | **buffer** | fillSpanRect → fillRect | B | as `snpCov` with per-instance packed colour; converted with it |
| alignments | `interbase` · coverageInterbase | coverageBand, hpmath | default | **buffer** | fillRect (1 px) | B | 1 px bar hanging from `covAreaTop`, edges from exported `interbaseEdgePx` |
| alignments | `indicator` · coverageIndicator | coverageBand, hpmath | default | **buffer** | triangle path + fill | B | 7×4.5 px triangle; barycentric `smoothstep` edge fade only |
| alignments | `arcLine` · arcLine | antialias, hpmath | default | arrays | moveTo/lineTo/stroke | B | full-band vertical tick, analytic edge AA only, palette slot |
| alignments | `arc` · arc (triangle-strip) | antialias | default | arrays | ellipse + stroke | B | hull + analytic SDF stroke; Canvas2D primitive is `ellipse()`; `arcRadiiPx` already exported as a pair. Far-circle legs need `asin` on the GPU only |
| alignments | `arcFlat` · arcFlat | antialias, colorPack, hpmath | default | arrays | setLineDash + moveTo/lineTo/stroke | B | horizontal bar, uniform colour × `ARC_FLAT_ALPHA`; dash via `dashCoverage` (js-skipped — Canvas2D dashes by period) |
| alignments | `arcMarker` · arcMarker | hpmath | default | arrays | fillRect | B | 5 px square at a band point, palette slot |
| alignments | `flatQuad` · flatQuad (overlay, not per region) | hpmath | default | arrays (selection bounds) | strokeRect | B | clip-space rect + `float4` colour, four quads forming a 2 px frame; trivially interpretable, but the buffer is built from `getSelectionBounds` each frame |
| canvas | `rect` · rect | hpmath, colorPack, featureGlyphUniforms, rectInstance | default | arrays | fillRect, strokeRectInside | B | span via exported `rectSpanPx`, y via `snapBoxTopPx`/`snapBoxHeightPx`, packed colour × density fade; outline is a per-fragment 1 px rule gated by exported `rectDrawsOutline` |
| canvas | `line` · line | hpmath, colorPack, lineInstance, featureGlyphUniforms | default | arrays | lineWidth 1 + moveTo/lineTo/stroke | B | 1 px quad at exported `snapBoxCenterYPx` |
| canvas | `chevron` · chevron (off `line`'s buffer, 1536 verts) | antialias, hpmath, colorPack, lineInstance | default | arrays | strokes of 3-point "<" paths | A | `aaGradient` is AA-only, but the geometry is a 12-vertex `switch` per chevron under a 128-slot budget — ADR-051's own proof that a vertex stage is not a geometry description. The five window decisions are exported already; the painter's unbounded loop is the correct twin |
| canvas | `arrow` · arrow (9 verts) | hpmath, colorPack, featureGlyphUniforms | default | arrays | fillRect stem + triangle path fill | B | stem rect + head triangle from exported `arrowDraws`/`arrowHeadHalfHeightPx`, packed colour |
| canvas | `continuation` · continuation (off `rect`'s buffer) | hpmath, colorPack, featureGlyphUniforms, rectInstance | default | arrays | lineWidth 1 + strokes of "<" paths | never (by the rule) | `fwidth(minBary)` is load-bearing: it carves an open 1 px stroke out of a filled triangle. The derivative exists because the GPU has no `lineWidth`; the Canvas2D twin is a stroke and all five decisions are exported. See "Where the rule misfires" |
| multi-row | `rect` · multiRow | rowRect (colorPack, hpmath) | default | arrays (buffer built main-thread via `InstanceWriter`) | fillRect | B | `rowRectClipPos` quad, packed colour; `drawnRowHeightPx`/`rowBandOffsetPx` exported |
| maf | `rect` · maf | rowRect | default | arrays (run-merged `alignmentBytes`) | fillBpSpan → fillRect (+0.4 px seam) | B | as multi-row with `minCellPx = 0`; the GPU buffer is run-merged at encode time, so B would paint the merged runs the GPU paints |
| maf | `coverage` · coverageBar _re-reg_ | — | — | **buffer** | fillSpanRect | B | same pass object as alignments |
| maf | `snpCov` · coverageSnp _re-reg_ | — | — | **buffer** | fillSpanRect | B | |
| maf | `interbase` · coverageInterbase _re-reg_ | — | — | **buffer** | fillRect | B | |
| maf | `indicator` · coverageIndicator _re-reg_ | — | — | **buffer** | triangle fill | B | |
| dotplot | `line` · dotplot | antialias, capsule, colorPack, hpmath | premultiplied | arrays (Float64 absolute cumBp) | lineWidth + lineCap round + moveTo/lineTo/stroke | B | capsule; `capsuleDist` is load-bearing for the round cap and `lineCap: 'round'` is its twin. The packed buffer is window-relative f32 where the painter uses Float64 — B changes the painter's precision to the GPU's |
| gwas | `point` · manhattan | antialias, hpmath, colorPack, pointGlyph | default | arrays | rect / arc / triangle / diamond paths + fill | B | shape chosen in the vertex stage (bar, crisp square, disc, tri, diamond); `glyphEdgeAlpha` derivative is AA only; `scoreToYPx` exported; GPU bar carries `BAR_OVERDRAW_PX` the painter lacks |
| hic | `main` · hic (global) | colorRampLut, diagonalGrid, hpmath | premultiplied | **buffer** (generated accessors) | translate/scale/rotate + fillRect | never | samples `colorRamp`. The one texture case with an exact CPU twin — a 1-D LUT of a clamped scalar, `makeRampFillStyleLut` already indexes the same 256 entries |
| LD | `main` · ldUniform (global) | ldUniforms (colorRampLut, diagonalGrid), hpmath | premultiplied | arrays (`boundaries` + `ldValues`) | moveTo/lineTo ×3/fill (hand-rotated rhombus) | never | samples `colorRamp`; cell position decoded from `SV_InstanceID` (`decodeBanded` → `vec2<u32>`) |
| LD | `genomic` · ldGenomic (global) | ldUniforms, hpmath | premultiplied | arrays | as above | never | samples `colorRamp` |
| variants | `main` · variant | antialias, hpmath, colorPack | premultiplied | arrays | fillRect, or 3-point triangle fill | B | rect or left-pointing triangle; `edgeCoverage` is analytic and only carves the triangle; `smallMarkFade` js-skipped (GPU-only); `drawnCellHeightPx`/`snappedCellWidthPx`/`snappedCellLeftPx` exported |
| variant matrix | `main` · variantMatrix (global) | colorPack, hpmath | premultiplied | arrays | fillRect (+0.3 px `f2`) | B (divergent) | per-fragment `inside × cov` is a coverage rule in physical px; `expandToMinWidthPx` is js-skipped as "a different rule, not a twin". Interpretable, but B would change what Canvas2D draws |
| wiggle | `fill` · wiggle | antialias, hpmath, colorPack, pointGlyph, wiggleCommon | default | arrays | fillRect (xyplot, +0.8 `WIGGLE_FUDGE_FACTOR`) / `appendPointMarker` arc or rect (scatter) | B | bar from `scoreToY(origin)` to `scoreToY(score)`, or disc/crisp square; `discAlpha` derivative AA only; `MIN_FILL_WIDTH_PX` floor via `extendToMinWidthX` |
| wiggle | `density` · wiggleDensity (off `fill`'s buffer) | hpmath, colorPack, colorRampLut, rowRect, scoreScale, wiggleCommon | default | arrays | fillRect | never | samples `colorRamp` when `densityRampLut == 1`; the other mode is a vertex `lerp(white, colour, densityGradientT)` that IS interpretable, and `densityGradientT` is exported |
| wiggle | `line` · wiggleLine (18 verts) | antialias, capsule, hpmath, colorPack, wiggleCommon | default | arrays | polyline moveTo/lineTo/stroke | B | three square-capped quads per feature (step line); no AA by design |
| wiggle | `lineCenter` · wiggleLine (off `line`'s buffer) | capsule | `{ op: 'max' }` | arrays | lineJoin/lineCap round + polyline stroke | B | capsule per feature, `NO_PREV_START` collapses to a dot; max blend is `globalCompositeOperation = 'lighten'` |
| synteny | `fillStraight` · syntenyFillStraight | syntenyTypes (hpmath, antialias, colorPack) | default | arrays (SoA) | polygon fill, or 1 px centreline stroke when sub-pixel | B (divergent) | quad between two edge lines; `perpCoverage` is a per-fragment width estimator deliberately different from the painter's whole-ribbon `ribbonPerpWidth` (js-skipped). CIGAR pre-blend with `u.ground` is `float3` math |
| synteny | `fillCurve` · syntenyFillCurve (48 verts) | syntenyTypes | default | arrays | bezierCurveTo fill | B | 8-trapezoid hull with Newton inversion in the fragment; the mark is a cubic Canvas2D already draws exactly. The join is `syntenyShaderParity.test.ts` over `sBlend`/`yCurve`, never a transliterated tessellation |
| synteny | `edgeStraight` · syntenyEdgeStraight | syntenyTypes | default | own buffer (byte copy of the clicked feature) | lineWidth 1 + side-edge strokes | B | uniform `u.ink` × `STROKE_ALPHA`; the `aaRamp` band IS the 1 px stroke |
| synteny | `edgeCurve` · syntenyEdgeCurve | syntenyTypes | default | own buffer | bezier side-edge strokes | B | as above |
| multi-way | `fillStraight`/`fillCurve` _re-reg_ | — | — | arrays | same `drawSyntenyTrack` | B | `edge*` registered, never drawn (`clickedFeatureId` is 0) |
| multi-way | `edgeStraight`/`edgeCurve` _re-reg_ | — | — | — | — | B | |
| multi-way | `rect`/`line`/`arrow` _re-reg_ | — | — | arrays (`LaneGlyphData`) | `CANVAS_GLYPH_DRAW` | B | same painters as canvas |
| multi-way | `chevron` _re-reg_ | — | — | arrays | inline in `drawLines` | A | |

### The counts

Distinct passes: **45** (57 registrations). By tier, over the 45:

| Tier | Passes |
| --- | --- |
| B | **38** — 5 of them already read the packed buffer (the coverage band; 9 registrations counting MAF's), 2 are flagged _divergent_ (`variantMatrix`, `fillStraight`) and `dotplot` changes precision, and 6 carry a Canvas2D-only seam pad (`perBaseQuality`, `softclipBases`, `perBaseLetter`, `coverage`, `maf rect`, `wiggle fill`) — see below |
| A | **2** — `read`, `chevron` |
| never | **5** — `hic`, `ld main`, `ld genomic`, `wiggle density` (texture), `continuation` (derivative) |
| C-eligible today | **0** — no pass has both its rect and its colour available as exported scalars; the colour is always the blocker |

Of the 38 B rows, the geometry lands on `fillRect` alone for 20, on a stroked
segment or polyline for 8 (`connLine`, `linkedReadLine`, `arcLine`, `arcFlat`,
`line`, `wiggle line`, `wiggle lineCenter`, `dotplot`), on `ellipse` for 1
(`arc`), on a per-instance choice of rect/disc/path for 1 (`gwas`), and on a
filled path for 8 (triangles beside a rect: `indicator`, `arrow`, `insertion`,
`variant`; polygons and beziers: the four synteny passes).

### Where the rule misfires, and the two rows it decides

`continuation` is "never" by the letter of the rule and should not be. Its
`fwidth` converts a barycentric to pixels so the fragment can keep a 1 px band
along two edges of a filled triangle — the GPU spelling of `lineWidth = 1`. That
is the same move `arc` makes with an analytic SDF and `edgeStraight` makes with
`aaRamp`, both classified B here. The rule that survives contact is: **a
derivative or SDF that measures a stroke width is a stroke, and Canvas2D has
`lineWidth`**; only a derivative that chooses _which_ mark to draw disqualifies.
Nothing in the tree does that. Under the refined rule the never count is 4 and
they are all texture samples.

`hic` is "never" by the letter and is the strongest argument for refining the
texture half too. Its sample is `rampColorPremultiplied(colorRamp, t)` — a
1-D LUT of a clamped scalar, 256 entries, nearest-with-half-texel. The Canvas2D
painter already indexes the same 256 entries through `makeRampFillStyleLut`. The
three LD/density samples are the same function over the same module. So the
four texture "never"s are one refusal — `colorRampLut.rampColor` — and a
`rampIndex(t)` scalar export would make all four interpretable. That is a
follow-on; the counts above do not assume it.

## What the census actually found

**The threshold is cleared by a wide margin, and the margin is not where the
handoff expected it.** Thirty-eight B against a bar of eight. But nine of those
already read the buffer (the coverage band, on both renderers, and `hic`),
which the handoff did not know, and they are the ones where B is nearly done —
`drawCoverageBins` is an interpreter of `coverageLayout.generated.ts` already,
missing only `covBarScale`/`covBottom`/`covSegQuad` as generated twins instead
of `coverageLayout()` re-deriving the box. **That conversion landed 2026-09-04**
— see §Recommendation and §Owed for what it decided.

**The colour is the blocker for C, everywhere.** Not one B pass has its colour
as an exported scalar. The shader colour path is one of: `unpackRGBA(uint)`
(per-instance packed, 12 passes), a uniform slot read directly (`u.colorSkip`,
8 passes), a `switch` over uniform slots returning `float3` (`baseColor`,
`covSnpColor`, `covClipKindColor`, `arcColorByIndex`), a uniform array index
(`readCategoryColor[i]`, `linkedReadColor[i]`, `arcColor[i]`), or vector math
(`hueRampHalfSat`, `shadeFill`'s ground pre-blend, density's `lerp`). The
transliterator refuses all but the first, and the first needs no
transliteration at all — a packed ABGR is a `u32` the painter reads off the
buffer and formats. ADR-051's answer to the rest is not vector support; it is
the `arcColorSlot` / `linkedReadColorSlot` pattern, a scalar returning which
slot, with the painter owning the slot table. That is authoring work in the
`.slang`, about ten functions, before a `//! canvas2d:` directive has anything
to name.

**The rect is the smaller problem than it looks, because of the `Uniforms`
parameter.** Every vertex-side px decision a B interpreter needs —
`pileupCellX`, `pileupY`, `pileupRowTopPx`, `bpToClipX`, `covBaselinePx`,
`covEffHeight`, `covAreaTop`, `covBpToClipX`, `arcBandX`, `arcBandY`,
`arcStrokeHalfPx` — takes the whole uniform struct, and slangc emits that as
`ptr<function, Uniforms>`, which is the transliterator's largest refusal class
(18 functions; it was 19 with `covBarScale` and `covBottom` in it, and the
coverage-band conversion below is what took them out). The two ways out are the ADR-051 factoring (a scalar core
taking the two or three fields it reads, wrapped for the shader) or teaching the
emitter a struct parameter as a typed object off the generated `Uniforms`
interface. The second is a real extension but a bounded one: member access on a
_parameter_, never on a local, never a swizzle.

**`fillRect` is not the whole story: the primitive set is five, not one.** A
directive that only knows `fillRect` covers 20 rows. Eight rows are strokes,
which Canvas2D expresses as `lineWidth` + `lineCap`, and that is exactly the
translation the handoff's own shape table promised for `capsule` — but it means
`//! canvas2d:` needs `strokeSegment(x1, y1, x2, y2, widthPx, cap, color)`
alongside `fillRect`, plus `fillTriangle`, `strokeEllipseArc` and (for the
synteny ribbons) a polygon/bezier form nobody should generate. The right cut is
to declare the first two and leave the paths hand-written under Tier A.

**The seam pads are the intentional divergences, and they are on B rows.**
`PILEUP_CELL_SEAM_FUDGE_PX` 0.5, `COVERAGE_BAR_SEAM_FUDGE_PX` 0.8, MAF's
`GAP_STROKE_OFFSET` 0.4, `WIGGLE_FUDGE_FACTOR` 0.8, the variant matrix `f2` 0.3.
GPU_RENDERING.md §"Intentional divergences" says do not fix these into parity,
and `MarkCanvas2D.contiguous` exists to keep them visible per backend. A
generated painter has to carry a per-pass overdraw parameter or it deletes
them, and deleting them is the hairline-seam regression the pads were added
for. This is a one-field cost, not a blocker, but it is why "the pixel diff
becomes a tautology" overstates: the diff on those rows will still show the
pad, on purpose.

**Three rows are B by the rule and should not be converted.** `variantMatrix`'s
sub-pixel column rule and synteny `fillStraight`'s width estimator are each
documented as a deliberately different Canvas2D rule (`expandToMinWidthPx` and
`perpCoverage` in the `//! js-skip` table). `dotplot` projects from Float64
absolute cumBp on Canvas2D and from window-relative f32 on the GPU; B would
move the painter to the GPU's precision, which may be fine and is a decision.

**The alignments pileup is where B collides with something already built.**
[ideas/one-mark-declaration-per-feature](one-mark-declaration-per-feature.md)
spent August making the pack, the paint and the hit test of nine pileup
features derive from one `PileupMark` — and it found a live GPU/Canvas2D bug
by doing so. Tier B derives the paint from the packed buffer instead. Both are
"one source", but they are different sources, and the hit test cannot follow B:
`findMarkAt` scans the mark's row array, and the packed buffer has no feature
index in it. For the 12 pileup B rows the choice is therefore not "hand-written
vs generated" but "mark-derived vs buffer-derived", and a painter reading the
buffer while the hit test reads the mark is the two-description drift that
`hitTestGateParity.test.ts` exists to catch. B fits the pileup only if
`paintMarks` itself becomes the buffer interpreter, taking the mark's `pack` as
the join. That is a design question this census does not settle; it does mean
the pileup is not the place to start.

**Text and image blits: none in any backend, all in overlays.** Zero `fillText`,
`drawImage` or `putImageData` in any of the 13 `draw` paths. Every letter the
user sees is a separate overlay canvas composited on both backends and appended
independently by each `renderSvg.tsx`: alignments' `drawAlignmentLabels`
(deletion lengths, insertion counts in the box the GPU pass draws empty,
softclip summaries, mismatch base letters, per-base letters), MAF's
`drawMafLabels`/insertions/codons/deletion counts, canvas's `paintLabels` and
peptides, multi-row's indel counts, variants' insertion I-beams and counts,
synteny's offscreen-mate refNames. So B and C make SVG export correct by
construction _for the marks_, and the marks were never where SVG export drifted
— the text path is already backend-independent and stays hand-written whatever
happens here. The claim to make is narrower than the handoff's: three-way
parity shrinks to two-way for the marks; the labels were two-way already.

## Prior art: GenomeSpy's immediate layer

Since 2026-08-19 GenomeSpy (`~/src/vendor/genome-spy`,
`packages/core/src/rendering/`) ships a Canvas2D compatibility renderer, an SVG
exporter and software picking that all consume one hand-written CPU geometry
layer, `immediate/marks/{rect,arrow,point,rule,link,text}.js`: each mark
projects, applies its min-size/seam-pad/opacity rules and culls, then hands a
mutable occurrence record to a visitor, and `canvas2d/renderers/rect.js` and
`svg/renderers/rect.js` are thin emitters over that record (their `rect.js`
even carries the same `RECT_SEAM_PADDING` we keep per backend). The point for
this census: a grammar-based renderer that _generates_ its GLSL and WGSL still
ended up writing per-mark CPU geometry by hand as a **third** description, and
consolidated across the CPU consumers — Canvas2D, SVG and picking share one
visitor — rather than shader-to-CPU. Our Tier B sits on that same axis with a
different join: their visitor is our packed instance buffer plus the
`INSTANCE_OFFSET` maps, which is a join the GPU also reads, where their
immediate layer has no mechanical relation to either shader. What they have
that we lack is picking off the same record; what we have that they lack is
that the CPU description is checked against the GPU's at `gen:shaders` time.

## The transliterator gaps, by function

What the emitter would have to grow, or the `.slang` would have to factor,
for the B rows — with the shape-module functions named so item 2 of the
handoff (hit geometry from the containment SDFs) can share the list.

| Gap | Functions that hit it | Which side |
| --- | --- | --- |
| struct parameter (`ptr<function, Uniforms>`) | `pileupCellX`, `pileupY`, `pileupRowTopPx`, `pileupRowCenterPx`, `bpToClipX` (alignments, canvas, wiggle), `flippedQuadPos`, `covBaselinePx`, `covEffHeight`, `covAreaTop`, `covBpToClipX`, `covSegQuad`, `arcBandX`, `arcBandY`, `arcStrokeHalfPx`, `arcYDir`/`arcsPointDown`, `covSnpColor`, `covClipKindColor`, `arcColorByIndex` | B rect + colour. **Decided on the coverage band, 2026-09-04: factor scalar cores** (ADR-051's `snapBoxCenterY` move), do not admit a struct parameter — see §Owed |
| `vec2` parameter / locals / swizzle | `capsuleDist(float2 local, float halfLenPx)`, `capsuleFrame`, `discCoverage(float2)`, `crispSquareCornerPx(float2, …)`, `sdEllipse(float2 p, float2 radii)`, `distToWideCircle(float2, float)`, `triSdfRight`, `serifPos`, `expandToMinWidthPx` (float2 return, js-skipped) | Item 2 above all: `capsuleDist` is the hit test for dotplot, wiggle `lineCenter` and `linkedReadLine`; `sdEllipse` for arcs; `triSdfRight` for the variant triangle. The scalar-core split works for `capsuleDist` (`(dx, dy, halfLen)`) and `distToWideCircle` (already done as `distToWideCirclePx`); `sdEllipse` is genuinely 2-D |
| `vec3`/`vec4` return (colour) | `unpackRGBA`, `baseColor`, `covSnpColor`, `covClipKindColor`, `arcColorByIndex`, `hueRampHalfSat`, `shadeFill`, `categoryPaletteColor`, density `lerp(white, rgb, t)` | C's second argument. Do not add vectors: author `*Slot(...) -> uint` twins as `arcColorSlot` did, and leave `unpackRGBA` to the painter's `abgrToCssRgba` |
| uniform array indexing | `readCategoryColor[colorCategory]`, `linkedReadColor[slot]`, `arcColor[slot]`, `getWord` | Same answer: the slot is the export, the table is the painter's |
| struct return | `rowBandPx` → `RowBand`, `capsuleFrame` → `CapsuleFrame`, `arcCurve` → `Curve` | `rowBandPx` is already split into two exported scalars; the others are vertex-only |
| `length` | `capsuleDist`, `discCoverage`, `aaGradient` | `Math.hypot` is exact enough and is the one builtin worth adding; `aaGradient` stays refused (derivative) |
| `asin` | `legSweepAngle` (arc far-circle legs) | Not needed — the painter takes `ellipse()` angles from `arcRadiiPx`; a hit test uses `distToWideCirclePx` |
| `sin`/`cos`/`acos` | `evalArcVertex`, `hueRampHalfSat` | Vertex tessellation and a hue ramp; neither should be transliterated. `hueRampHalfSat` vs the painter's `hsl()` string is an accepted divergence |
| texture sample | `rampColor`, `rampColorPremultiplied` | Not a transliteration gap — export a `rampIndex(t) -> u32` scalar from `colorRampLut.slang` and the four texture "never"s become B |
| derivative | `aaGradient`, `glyphEdgeAlpha`, `fwidth` in `continuation` | Never transliterate. Canvas2D antialiases; `continuation`'s is a stroke |
| `saturate`, `select`, `lerp` | none, `mix`, none | `lerp` lowers to `mix`, already handled; no shader uses `saturate`; slangc lowers `?:` before the emitter sees it |

## Recommendation

**Build B, not C, and build it on the coverage band.** The count justifies the
mechanism thirty-eight times over against a bar of eight, and the handoff's
"if two, do not" was the real risk — it did not materialise. But C's premise,
that a directive can name exported functions for both the rect and the colour,
is false for every pass today because no colour is an exported scalar, and the
primitive set C would need is five wide. B needs no directive and no new
generated artifact: an interpreter is a TypeScript function over a generated
`.iface.generated.ts` layout plus the shader's `.js.generated.ts` twins, which
is what `drawCoverageBins` already is. Revisit C only after B has produced a
few interpreters that look identical enough to want a generator — that is the
[ADR-040](../architecture-decision-records/adr-040-no-genome-quad-vertex-helper.md)
bar applied to codegen, and it is the right bar.

**First pass: `coverage` (`coverageBar.slang`), then the other four band
passes — DONE 2026-09-04, and it took `snpCov` and `modCov` with it.** The
painter reads the packed buffer already, through the generated layout; it is
shared by two renderers so the payoff lands twice; the colour is one uniform slot
(`u.colorCoverage`) so the colour problem is trivially solved. What landed is
`covBarHeightPx`, `covSegBottomPx` and `covSegTopPx` — `covSegQuad`'s whole
vertical half, exported into `coverageBandLayout.generated.ts` beside
`normalizeDepthScalar`/`covEffectiveHeightPx`/`covBottomOffsetPx` — with
`covSegQuad` itself rewritten to call them and convert once, so the three
Canvas2D painters and the vertex stage now run the same three functions.
`covBarScale` and `covBottom` are gone: the clip-space wrappers had no caller
left once the decision moved into px. Gate:
`coverageBandLayoutParity.test.ts`, carrying the retired composition verbatim
and sweeping it (the `hpmathParity.test.ts` pattern);
`coverageParity.test.ts` now reads a recorded `fillRect` against
`covSegTopPx` where it had a formula restated on both sides of an `expect`.

Three things the conversion says that the plan did not:

- **`coverageLayout` does not retire, and should not.** It was already generated-
  backed (`covEffectiveHeightPx` / `covBottomOffsetPx`, with its own retirement
  gate), and the coverage axis and MAF's conservation band read the same box. The
  hand-written thing was never the box; it was the *composition* on top of it,
  stated three times in `rendererUtils.ts`.
- **The seam pad needed no parameter.** It is a width, applied by `fillSpanRect`
  after the placement, and the placement is what got lifted — so the per-pass
  overdraw the plan wanted to design here has nothing to attach to yet. It will
  when the x half lands, because `fillSpanRect` is where the two meet.
- **A `float2` return was the wrong shape, on this row.** Two scalar edges, not
  one pair: the tuple convention emits `[number, number]`, and these loops run
  per covered bp under a documented no-allocation bar. `rectSpanPx`'s pair is
  fine because it runs per feature. The precedent to copy is per-loop, not
  per-tree.
- **The two segment painters are now the same loop three differences apart.**
  `drawSnpSegments` and `drawModCovSegments` differ in which generated offset map
  they index, an allele-fraction gate, and where the colour comes from — nothing
  else. That is the evidence for the interpreter this file argues toward, and
  also the reason not to write it on a hunch: these loops index inline against a
  measured bar (`instanceAccessors.bench.ts`, 0.56-0.62x through the generated
  getters), and a parameterised loop reading its offsets off a passed-in object
  gives that up. Merge them behind a measurement, not before one.

**Second: `modification` / `perBaseQuality` (`packedColorQuad`), because they
are the pure `fillRect` + packed-colour case** and would settle whether
`paintMarks` becomes the interpreter for the pileup. If that lands cleanly, the
other ten pileup B rows follow the same route; if it fights `PileupMark`, stop
there and leave the pileup mark-derived — that outcome is fine, the band and
the seven non-alignments B displays are still worth it.

**Do not convert** `variantMatrix`, synteny `fillStraight`, or `dotplot`
without first deciding the documented divergence each carries, and do not
touch `read`, `chevron`, `continuation` or the text overlays — the last are
correct by construction already, in the only way text can be.

## Owed

- **DECIDED 2026-09-04: the tree keeps factoring scalar cores; the emitter does
  not learn a struct parameter.** Not on emitter cost — member access on a
  parameter is a bounded change — but because *the consumer has no struct to
  pass*. `CoverageBandUniforms` is 25 fields the GPU renderer assembles at draw
  time: an hp-split bp range, `canvasW`/`canvasH`, the `hpZero` sentinel, packed
  ABGR colours. The Canvas2D painter holds a band height, a `normalizeDepth`
  closure and a `bpToX` closure, and a twin taking `Uniforms` would make it build
  a UBO it never uploads — importing clip space and the HP split into a path that
  has neither — to read two fields out the other side. The factoring cost three
  lines of `.slang` and no emitter change at all; the scalar cores are also
  reusable across the band's five passes and its axis, where a struct-parameter
  twin is per-uniform-block. Revisit only for a function whose fields outnumber
  what a caller can plausibly hold, which nothing in the census does.
- The x half of `covSegQuad`, which this conversion did **not** take.
  `fillSpanRect` is already a faithful twin of `expandToMinWidthPx(x1, x2, 1)`,
  so the `//! js-skip` calling that rule "a different rule, not a twin" was stale
  — it was written against the pileup cell and the variant matrix, which do floor
  differently, and never looked at the band. Both skips now say so.
  Lifting it needs an owner that can redirect into
  `@jbrowse/alignments-core`: `coverageBand.slang` is a module and can only
  export its own functions, and the rule is hpmath's and shared with the pileup's
  `expandMinWidthX`, so naming it after the band would misattribute it. An
  entry-point shader with a `//! js-export-out` is the mechanism; which shader
  owns it is the open question.
- The band's other two passes, `interbase` and `indicator`, which do not go
  through `covSegQuad` — `interbaseEdgePx` already covers the first's edges.
- The `rampIndex` export that would move the four texture passes to B — small,
  and it decides whether Hi-C and LD join the set.
- Nothing in the census itself was run. Pass counts, blend modes and painter
  calls were read off the sources named in the table; the `.iface.generated.ts`
  files were trusted to match their `.slang`, which `pnpm gen:shaders` enforces.
  The conversion above was run: `pnpm gen:shaders`, `pnpm test-related` (428
  suites), and a sabotage of the generated `covSegTopPx` to prove the new gate
  fails. No browser check.
- The same review's shader-derived hit tests (`chevronContains` for the pileup
  read's strand arrowhead, `capsuleDistPx` for the dotplot pick) have unit and
  oracle coverage only — `hitTest.test.ts`, `dotplotPickEngine.test.ts` — and
  nobody has hovered either one in a browser.
