---
name: split-the-arc-bands-uniforms-off-the-pileup-struct
description: The arc band is the last consumer of a memcpy-the-pileup-UBO-and-poke-it pattern, and giving it a declared struct is worth doing on code-quality grounds — but NOT for the memory number it was first proposed on. That 4 MiB -> 2 MiB is really 4 -> 3, because `linkedReadColor[8]` is a pileup layer's, and what would actually cross the 512-byte line is packing `readCategoryColor[23]`. Read before re-proposing either.
---

# Split the arc band's uniforms off the pileup struct

Moved out of [TODO.md](../TODO.md) on 2026-08-26. The saving that justified it
did not survive checking, and what remains is a refactor whose payoff nothing
has shown a real session is short of.

The coverage band's move to `CoverageBandUniforms` (2026-08) left the arc band as
the last consumer of the pattern's opposite: `GpuAlignmentsRenderer` memcpys the
whole 800-byte pileup UBO into `uArc` and pokes the band-sensitive slots on top
(`copyUboToArcScratch` + `fillArcUniforms`), once per section per block per
frame. render-core's CLAUDE.md names two uniform-write patterns and this is
neither — it is a partial write over a copy, and a slot the poke forgets silently
redraws with the pileup's value.

Giving the arc passes their own declared struct is the same move `coverageBand`
made and is worth doing on that ground alone. **What is NOT worth doing is doing
it for the memory number**, which is where this was first proposed and where it
does not survive checking.

## The corrected inventory

The proposal listed `blockStartPx`, `blockWidth`, `pairedArcsDown`,
`arcsYDomainBp`, `arcsYLog`, `lineWidthPx`, `arcColor[9]` and
`linkedReadColor[8]` as arc-only, and took the struct from 800 bytes to ~500 —
across the 512-byte line, halving the WebGPU ring.

`linkedReadColor[8]` is not arc-only. `linkedReadLine.slang` is the only shader
that reads it, and it is `GPU_PILEUP_PASS.linkedReadLine` — a **pileup** layer in
`PILEUP_LAYERS`, drawn inside the pileup band against the pileup UBO, after
`writeUniforms(sectionState, frame)` and before `drawArcsPass` writes `uArc` at
all. Its 128 bytes stay.

What actually moves is 43 words / 172 bytes: the six scalars, `arcColor[9]` (36
words) and `arcBandH`. `colorFlatConnector` is genuinely arc-only too (arcFlat is
its only reader) for one more word.

Laying the remainder out by the std140 rule the current offsets confirm — ten
floats, five i32, `reversed`, fourteen color uints, pad to a 16-byte boundary,
`linkedReadColor[8]`, `readCategoryColor[23]`, `pxPerBp`, `dpr` — gives 158 words
rounded to **160 words = 640 bytes**. `minUniformBufferOffsetAlignment` is 256,
so the slot is 768, not 512. The ring is `2048 * alignedUniformSize` on the GPU
buffer AND on the CPU staging array, so the saving is **4 MiB -> 3 MiB per
track**, not 4 -> 2.

The new `ArcBandUniforms` has to restate the shared prefix (the HP bp range,
canvas box, `covOffset` as the arc anchor, `reversed`, `pxPerBp`, `dpr`) the way
`CoverageBandUniforms` does — around 56 words, comfortably under the 768 the
trimmed pileup struct sets, so it does not raise the slot back.

## What would actually reach 512

`readCategoryColor[23]` is 368 bytes and the single largest field. std140 pads a
`float4[]` element to 16 bytes whatever it holds, so the packed-ABGR form of the
same 23 colours would be `uint4[6]` = 96 bytes — 272 bytes off, which crosses the
line on its own and would leave the arc split as a pure code-quality change.
`alignmentsUniforms.slang` says slangc cannot compile the packed form
(colorPack.slang); whether that applies to a `uint4[]` the shader indexes by hand
is the thing to check first, and it is a smaller change than either.

## Where the budget question lives

[cut-webgl2-contexts-per-display](cut-webgl2-contexts-per-display.md) is about
CONTEXT count, not bytes, and its measure-first note applies here too: 17 tracks
x 1 MiB saved is 17 MiB, and nothing has yet shown that the ring is what a real
session is short of. Measure before spending the regen.
