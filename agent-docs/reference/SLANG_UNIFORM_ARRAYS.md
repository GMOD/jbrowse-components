---
name: slang-uniform-arrays
description: An indexed palette in a uniform block must be float4[N], never a scalar array — slangc segfaults on the scalar form for WGSL with no diagnostic. Read before adding an array uniform, or when gen:shaders dies with no message.
audience: internal
kind: spec
---

# Array members in a uniform block

A palette the shader indexes at runtime (`u.linkedReadColor[colorType]`) belongs in the
uniform block as an array. Before 2026-08 none of them were: `linkedReadColor0..7` and a nine-colour
arc palette (since removed) were separately-named scalars, and the shader could not
subscript them, so a selector helper copied all of them into a local array **on
every vertex** just to select one. The codegen made up for it with a heuristic
that guessed at arrays by field NAME — any two fields sharing a prefix with
consecutive integer suffixes from 0 — which also invented one that wasn't
(synteny's `panPx0`/`panPx1` is a per-side pan pair, and got a slot array nothing
could sensibly index).

Both are gone. The codegen reflects `kind: 'array'` properly and emits real
element offsets. What follows is the one rule you have to know.

## Declare it `float4[N]`. Never a scalar array.

```slang
public float4 linkedReadColor[LINKED_READ_COLOR_SLOTS];  // correct
public uint   linkedReadColor[LINKED_READ_COLOR_SLOTS];  // segfaults slangc, for WGSL only
```

**slangc v2026.5.2 cannot compile a scalar array in a uniform block for WGSL, and
does not say so.** It exits on signal 11 with no diagnostic, so the build reports
only that the compiler died.

Narrowed by bisection, so that nobody repeats it:

- Reading the array is **not** the problem — `u.linkedReadColor[i] & 255u` compiles.
- The trigger is passing an element to a **cross-module function**.
  `unpackRGBA(u.linkedReadColor[i])` is that shape, and `unpackRGBA` lives in
  `colorPack.slang`.
- Hoisting the element into a local first does **not** help. It is the call
  boundary, not the load.
- `[ForceInline]` on the callee dodges the crash and then emits **invalid WGSL**
  (a bare `…data_0[i].x;` expression statement, which naga rejects). There is no
  spelling of the scalar form that works.
- **GLSL compiles the same source fine.** That is what makes this easy to hit and
  hard to attribute: everything is green until the WebGPU backend.

The mechanism, as far as the emitted code shows it: a scalar array member becomes
a `_Array_std140_uintN` wrapper struct, because std140 pads every array element
to 16 bytes and slangc materializes that as `array<vec4<u32>, N>`. A vector
element needs no wrapper and lowers correctly.

### The rule costs nothing

std140 pads an array element to 16 bytes **whatever it holds**, so `float4[9]`
and `uint[9]` occupy the identical 144 bytes, so one colour per `uint` element
saves nothing and still costs an unpack per vertex. Four colours to a `uint4`
element, read as `p[i >> 2][i & 3]`, compiles and does save space; on
alignments' 23-colour palette we measured it and declined
(`colorPack.slang`, `ARCHITECTURAL_LIMITS.md` §"The uniform ring"). Packing
colors into a `uint` also pays in a **vertex attribute** — one attribute instead
of four floats — and that is unaffected, because vertex attributes cannot be
arrays at all.

## What enforces this

- `codegen.ts` **refuses** a scalar array in a uniform block at `pnpm
  gen:shaders`, with a message naming the `float4[N]` fix. That is the guard: it
  turns a signal-11 death into a sentence.
- `instanceAttrs` refuses an array in an *instance* struct, which has no
  `@location` form and no answer for element padding.
- `assertModeledFieldType` (reflection.ts) refuses **any** field shape outside
  scalars / vectors / uniform arrays of either, in a uniform block or an instance
  struct. slangc's JSON is an open world and `reflection.ts`'s types are a closed
  one, so before this gate an unmodeled shape didn't hit a `default:` anywhere —
  it fell through to whichever branch tested last. A `float4x4` uniform (no
  `elementCount`) reached the vector branch and emitted `xform: []`, a
  `writeUniforms` that never wrote it, and one word offset standing for sixteen;
  a nested struct threw a bare TypeError from `viewOf`; a `bool` scalar (slangc
  really emits `scalarType: "bool"`) was absorbed as f32. Extend the model rather
  than the gate — `sizeOf`'s 4-bytes-per-scalar and `viewOf`'s three views are
  the two places that assume the closed world hardest.
- `colorPack.slang` carries the short version at `unpackRGBA`, where you would be
  standing when you wrote the bad thing.

## Reading a palette from TS

`UNIFORM_SLOT_ARRAYS.<field>` gives the **word offset of each element**, computed
from the reflected array. They are not consecutive — element `i` is at `base + i
* uniformStride / 4`, and for a `float4` that is every 4th word. Write through
the view the element's scalar type picks (`f32` for `float4`), exactly as with
`UNIFORM_OFFSET_*`:

```ts
for (let i = 0; i < USLOTS.linkedReadColor.length; i++) {
  const at = USLOTS.linkedReadColor[i]!
  f32[at] = rgb[0]; f32[at + 1] = rgb[1]; f32[at + 2] = rgb[2]; f32[at + 3] = 1
}
```

Drive the loop from the **shader's** slot count, not the palette's. A palette
that fell out of step then leaves an `undefined` rather than silently painting
whatever the last block render left in the slots it didn't reach.

`Uniforms` types the field as a fixed-length tuple, so `writeUniforms` won't
accept a palette of the wrong size at all.

## Indexed palettes beat branch chains

`read.slang` used to map a read's category to a color with a 17-arm `cat == RC_X`
chain over the named color uniforms. Its agreement with the legend was held
together by a test that **re-read read.slang's source with a regex** and matched
the arms against `swatchPaletteKeys` — pinning source text, breaking on
reformatting, and unable to catch the two sides agreeing on a spelling while
disagreeing on a color.

That is now `u.readCategoryColor[cat]`, filled by the CPU from the palette's
`readCategoryColors`, the colour `color` declares for each category over its
`readCategoryPaletteKeys` default. The legend and the GPU read one table, so
there is nothing left to reconcile — the scraping test is
deleted and `colorCategory.test.ts` checks data instead. The duplicated color
costs 352 bytes in a block that is written once per block render.

Reach for this shape whenever a shader is selecting a color by an index the CPU
already computed.

### A palette with one slot substituted is still a palette

The read-cloud endpoint squares used the arc palette with exactly one slot
swapped: opaque fills take the pale pileup-fill short-insert color, not the
saturated stroke the translucent arcs need. The shader first spelled that as a
branch **indexing a float4 array in one arm and unpacking a uint in the other**
— the 17-arm chain above in a smaller hat, with a comment promising the CPU
copy mirrored it. Uploading the substituted table as its own array deleted the
branch and the promise. The squares are a `point` mark pass now
(`arcMarks.ts`), but the rule stands: **if the CPU can name the substitution,
upload the substituted table** and let every renderer index the same one.

### Where the rule stops: a palette something overwrites at write time

`colorBaseA/C/G/T/N` look like the next candidate and are not. They are read
under two different index spaces by two shaders, and `effectiveBaseColors`
(`features/mismatch/baseColors.ts`) mutes all five to grey when
`showModifications` is on — so a `float4[5]` of them is
a second representation of a runtime-mutated color, which is a worse mirror than
the one it deletes. Declined in
[ADR-062](../architecture-decision-records/adr-062-base-colors-stay-named-uniforms.md),
which also covers the slot-indexed version that would actually work and what it
would cost.

The line the exception draws: **a palette the CPU can name once per block render
is this rule's shape; a palette something rewrites conditionally at write time is
not.**

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  — the JS-twin emitter, a different parity mechanism for a different problem.
- [reference/GPU_RENDERING.md](GPU_RENDERING.md) — the pass/UBO model these
  uniforms live in.
