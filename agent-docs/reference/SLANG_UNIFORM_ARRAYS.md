---
name: slang-uniform-arrays
description: An indexed palette in a uniform block must be float4[N], never a scalar array — slangc segfaults on the scalar form for WGSL with no diagnostic. Read before adding an array uniform, or when gen:shaders dies with no message.
audience: internal
kind: spec
---

# Array members in a uniform block

A palette the shader indexes at runtime (`u.linkedReadColor[colorType]`) belongs
in the uniform block as an array, not as separately named scalars the shader
cannot subscript. The codegen reflects `kind: 'array'` and emits real element
offsets; it does not guess arrays from field-name prefixes.

## Declare it `float4[N]`. Never a scalar array.

```slang
public float4 linkedReadColor[LINKED_READ_COLOR_SLOTS];  // correct
public uint   linkedReadColor[LINKED_READ_COLOR_SLOTS];  // segfaults slangc, for WGSL only
```

**slangc v2026.5.2 cannot compile a scalar array in a uniform block for WGSL, and
does not say so.** It exits on signal 11 with no diagnostic, so the build reports
only that the compiler died.

- Reading the array is fine: `u.linkedReadColor[i] & 255u` compiles.
- The trigger is passing an element to a **cross-module function**
  (`unpackRGBA(u.linkedReadColor[i])`, with `unpackRGBA` in `colorPack.slang`).
  Hoisting the element into a local does not help.
- `[ForceInline]` on the callee dodges the crash and emits invalid WGSL.
- **GLSL compiles the same source fine**, so everything is green until the
  WebGPU backend.

A scalar array member becomes a `_Array_std140_uintN` wrapper, because std140
pads every array element to 16 bytes. A vector element needs no wrapper.

The rule costs nothing: `float4[9]` and `uint[9]` occupy the same 144 bytes.
Packing four colours to a `uint4` element (`p[i >> 2][i & 3]`) does save space
and was measured and declined on alignments' 23-colour palette
(`colorPack.slang`, `ARCHITECTURAL_LIMITS.md` §"The uniform ring"). Packing a
colour into a `uint` still pays in a **vertex attribute**, which cannot be an
array.

## What enforces this

- `codegen.ts` refuses a scalar array in a uniform block at `pnpm gen:shaders`,
  naming the `float4[N]` fix.
- `instanceAttrs` refuses an array in an *instance* struct, which has no
  `@location` form.
- `assertModeledFieldType` (`reflection.ts`) refuses any field shape outside
  scalars, vectors and uniform arrays of either. slangc's JSON is open and
  `reflection.ts`'s types are closed, so an unmodeled shape (`float4x4`, a nested
  struct, a `bool` scalar) otherwise falls through to whichever branch tests
  last. Extend the model rather than the gate; `sizeOf` and `viewOf` assume the
  closed world hardest.
- `colorPack.slang` carries the short version at `unpackRGBA`.

## Writing a palette from TS

`UNIFORM_SLOT_ARRAYS.<field>` holds the **word offset of each element**, computed
from the reflected array. Offsets are not consecutive: element `i` is at
`base + i * uniformStride / 4`, every 4th word for a `float4`. Write through the
view the element's scalar type picks (`f32` for `float4`), as with
`UNIFORM_OFFSET_*`.

Drive the loop from the **shader's** slot count, not the palette's, so a palette
out of step leaves `undefined` rather than silently painting stale slots.
`Uniforms` types the field as a fixed-length tuple, so `writeUniforms` rejects a
palette of the wrong size.

## Indexed palettes beat branch chains

Select a colour by an index the CPU already computed with an indexed palette, not
an `if (cat == RC_X)` chain. `u.readCategoryColor[cat]` is filled from the
palette's `readCategoryColors`, so the legend and the GPU read one table and
`colorCategory.test.ts` checks data. The earlier chain was pinned by a test that
regex-scraped the shader source, which breaks on reformatting and cannot catch
two sides agreeing on a spelling but not a colour.

**If the CPU can name a substitution, upload the substituted table.** The
read-cloud endpoint squares take the arc palette with one slot swapped; a shader
branch indexing a `float4` array in one arm and unpacking a `uint` in the other,
with a comment promising the CPU copy mirrored it, was the chain again.

### Where the rule stops

A palette something overwrites at write time is not this shape.
`colorBaseA/C/G/T/N` are read under two index spaces by two shaders, and
`effectiveBaseColors` (`features/mismatch/baseColors.ts`) mutes all five to grey
when `showModifications` is on, so a `float4[5]` would be a second representation
of a runtime-mutated colour. Declined in
[ADR-062](../architecture-decision-records/adr-062-base-colors-stay-named-uniforms.md),
which also covers the slot-indexed version that would work.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md):
  the JS-twin emitter, a different parity mechanism.
- [GPU_RENDERING.md](GPU_RENDERING.md): the pass/UBO model these uniforms live in.
