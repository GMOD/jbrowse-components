---
name: pack-readcategorycolor-to-halve-the-alignments-uniform-ring
description: The alignments pileup UBO is 640 bytes, so its WebGPU ring slot rounds to 768 and the ring costs 3 MiB per track. `readCategoryColor[23]` is 368 of those bytes and would be 96 packed as `uint4[6]`, the one change that crosses the 512 line. `alignmentsUniforms.slang` says slangc cannot compile the packed form; whether that applies to a `uint4[]` the shader indexes by hand is what to check first. Nothing has shown a real session is short of the ring — measure before spending the regen.
---

# Pack `readCategoryColor` to halve the alignments uniform ring

The WebGPU ring is `2048 * alignedUniformSize` on the GPU buffer AND on the CPU
staging array, and `alignedUniformSize` rounds the largest struct any registered
pass declares up to `minUniformBufferOffsetAlignment` (256). The alignments
`Uniforms` block is 640 bytes, so the slot is 768 and the ring is 3 MiB per
track. Under 512 bytes it would be 2 MiB.

`readCategoryColor[23]` is 368 bytes and the single largest field. std140 pads a
`float4[]` element to 16 bytes whatever it holds, so the packed-ABGR form of the
same 23 colours would be `uint4[6]` = 96 bytes — 272 bytes off, which crosses the
line on its own. `alignmentsUniforms.slang` says slangc cannot compile the packed
form (colorPack.slang); **whether that applies to a `uint4[]` the shader indexes
by hand is the thing to check first**, and it is a smaller change than anything
else on this axis.

## What is already spent

The arc band's split off this struct has landed — `ArcBandUniforms`
(`arcBandUniforms.slang`) is 224 bytes, and `Uniforms` went 800 → 640, taking the
slot 1024 → 768 and the ring 4 MiB → 3 MiB per track. That was done on
code-quality grounds (a memcpy-and-poke is neither of render-core's two
uniform-write patterns) and the byte count was a side effect. There is no second
band left to lift out: `linkedReadColor[8]` is `linkedReadLine.slang`'s, a
**pileup** layer in `PILEUP_LAYERS`, so its 128 bytes stay.

## Where the budget question lives

[cut-webgl2-contexts-per-display](cut-webgl2-contexts-per-display.md) is about
CONTEXT count, not bytes, and its measure-first note applies here too: 17 tracks
x 1 MiB saved is 17 MiB, and nothing has yet shown that the ring is what a real
session is short of. Measure before spending the regen.
