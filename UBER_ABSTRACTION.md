# Uber Shader Abstraction

A build-time compiler that takes a single shader definition and emits WGSL, GLSL
ES 3.0, and Canvas2D TypeScript — eliminating the three-way manual sync.

## Problem

Every GPU-rendered display (alignments, variants, wiggle, canvas features) has
three parallel implementations of the same rendering logic:

1. **WGSL** — WebGPU path, reads from storage buffers
2. **GLSL ES 3.0** — WebGL2 fallback, reads from vertex attributes
3. **TypeScript** — Canvas2D/SVG fallback, reads from TypedArrays

These must stay in sync manually. Bugs (like the unmapped-mate brown override)
require fixing in all three places. The `// SYNC(...)` comments document the
problem without solving it.

## Constraints

The three backends have real architectural differences that can't be papered
over:

- **Data access**: WGSL uses `var<storage>` structs, GLSL uses `in` vertex
  attributes, TypeScript uses typed arrays. These are fundamentally different
  GPU data models (WebGL2 lacks SSBOs).
- **Uniform access**: Both shader languages use the same UBO layout
  (`array<vec4u, 40>`) with `uf()`/`ui()` accessors, but TypeScript reads
  palette values from a JS object.
- **Theme colors as uniforms**: The palette lives in the UBO so theme/scheme
  changes are a uniform update, not an instance buffer rebuild. This is correct
  and must be preserved — pre-computing colors on CPU would make scheme
  switching require rebuilding millions of instances (dev note: this is not a
  major concern though, 'scheme' or 'theme' change as i suspect this is
  referring to is very rare and a full re-render is fine in this case. so don't
  put too much weight on this).
- **Syntax**: WGSL and GLSL differ in type names (`vec3f` vs `vec3`), function
  declarations, control flow, and operator semantics.

## Proposal: `shadergen` build-time compiler

A TypeScript-authored DSL that describes shader logic once, compiling to all
three targets. Not a full shader language — just enough to express the math and
branching that's currently duplicated.

### What it covers

The **color computation functions** and **dispatch/override logic** — the parts
that actually drift apart. This is roughly:

- Per-display color helper functions (strand_color, mapq_color,
  insert_size_color, pair_orient_color, etc.)
- The `get_read_color()` dispatch — scheme selection, override conditions
- Similar patterns in other displays (variant cell color, wiggle bin color)

### What it does NOT cover

- Vertex position / geometry computation (language-specific, rarely changes)
- Data access / struct definitions (fundamentally different per backend)
- Uniform buffer preambles (already well-abstracted via `uboCommon.ts` /
  `common.ts`)
- Fragment shaders (simple, rarely duplicated)

### Architecture

```
shadergen/
  types.ts        — AST node types for the mini-DSL
  emit-wgsl.ts    — WGSL code emitter
  emit-glsl.ts    — GLSL ES 3.0 code emitter
  emit-ts.ts      — TypeScript function emitter
  index.ts        — public API: compile(definition) → { wgsl, glsl, ts }
```

### DSL design

The DSL is plain TypeScript data structures, not string templates. It models:

- **Scalar types**: `f32`, `i32`, `u32`, `bool`, `vec3f`
- **Expressions**: arithmetic, comparisons, function calls, uniform reads
- **Statements**: if/else, return, variable declarations
- **Functions**: named functions with typed parameters and return types

```typescript
import { fn, param, ret, if_, eq, call, uniform, palette } from './shadergen'

const strand_color = fn('strand_color', [param('s', 'i32')], 'vec3f', [
  if_(gt(ref('s'), lit(0)), [ret(palette('colorFwdStrand'))]),
  if_(lt(ref('s'), lit(0)), [ret(palette('colorRevStrand'))]),
  ret(palette('colorNostrand')),
])

const is_orientation_scheme = fn(
  'is_orientation_scheme',
  [param('cs', 'i32')],
  'bool',
  [
    ret(
      or(
        eq(ref('cs'), lit(3)),
        eq(ref('cs'), lit(5)),
        eq(ref('cs'), lit(6)),
        eq(ref('cs'), lit(10)),
      ),
    ),
  ],
)
```

Each emitter walks this AST and produces language-appropriate code:

**WGSL output:**

```wgsl
fn strand_color(s: i32) -> vec3f {
  if s > 0 { return color3(32u); }
  if s < 0 { return color3(35u); }
  return color3(38u);
}
```

**GLSL output:**

```glsl
vec3 strand_color(float s) {
  if (s > 0.5) return color3(32u);
  if (s < -0.5) return color3(35u);
  return color3(38u);
}
```

**TypeScript output:**

```typescript
function strandColor(s: number, palette: ColorPalette) {
  if (s > 0) return rgb255(palette.colorFwdStrand)
  if (s < 0) return rgb255(palette.colorRevStrand)
  return rgb255(palette.colorNostrand)
}
```

### Palette abstraction

The key difference between backends is how they access theme colors:

- **WGSL/GLSL**: `color3(U_COLOR_FWD)` — reads 3 floats from UBO at a slot
  offset
- **TypeScript**: `palette.colorFwdStrand` — reads from a JS object

The DSL uses `palette('colorFwdStrand')` which each emitter maps to the
appropriate access pattern. The mapping from palette name → UBO slot is defined
once in a shared constants file (already exists as `common.ts` `U_COLOR_*`
constants).

### Uniform access abstraction

Similarly for non-color uniforms:

- **WGSL/GLSL**: `ui(11u)` / `uf(21u)` — integer/float from UBO slot
- **TypeScript**: explicit parameter passing

The DSL uses `uniform('colorScheme', 'i32')` or
`uniform('insertSizeUpper', 'f32')`. Each emitter knows how to map these to slot
indices (WGSL/GLSL) or function parameters (TypeScript).

### Data access abstraction

Per-instance fields (flags, strand, insert_size, etc.) differ most across
backends:

- **WGSL**: `inst.flags` (struct field on storage buffer)
- **GLSL**: `fflags` (float cast of vertex attribute, with bit extraction via
  `mod(floor(x/N), 2.0)`)
- **TypeScript**: `data.readFlags[i]` (typed array index)

The DSL uses `field('flags', 'u32')`. Each emitter knows how to access this from
its respective data source. The GLSL emitter handles the float-bit extraction
pattern automatically.

### Build integration

The compiler runs as a build step (or a watched script during dev):

```
pnpm shadergen
```

It reads definition files like
`plugins/alignments/src/LinearAlignmentsDisplay/shadergen/readColor.def.ts` and
writes generated output files alongside the existing shader files:

```
shadergen/readColor.def.ts          ← source of truth
components/wgsl/readColorGen.ts     ← generated WGSL string export
components/shaders/readColorGen.ts  ← generated GLSL string export
colorUtilsGen.ts                    ← generated TypeScript functions
```

The hand-written shader files import and embed these generated snippets:

```typescript
// wgsl/readShader.ts
import { READ_COLOR_WGSL } from './readColorGen.ts'

export const READ_WGSL = `
${PREAMBLE}
${READ_COLOR_WGSL}

@vertex fn vs_main(...) {
  // ... geometry code stays hand-written ...
  out.color = vec4f(get_read_color(inst), 1.0);
}
`
```

### Scope of generated vs hand-written code

For the alignments read shader as a concrete example:

| Part                      | Generated? | Why                              |
| ------------------------- | ---------- | -------------------------------- |
| `strand_color()`          | Yes        | Identical math in all 3 backends |
| `mapq_color()`            | Yes        | Identical HSL→RGB conversion     |
| `insert_size_color()`     | Yes        | Same threshold logic             |
| `pair_orient_color()`     | Yes        | Same discrete mapping            |
| `is_orientation_scheme()` | Yes        | Override predicate               |
| `get_read_color()`        | Yes        | Dispatch + override logic        |
| `ReadInst` struct         | No         | WGSL struct vs GLSL attributes   |
| `vs_main()` / `main()`    | No         | Geometry is backend-specific     |
| `fs_main()` / fragment    | No         | Simple, rarely duplicated        |
| UBO preamble              | No         | Already well-abstracted          |

### Rollout

Start with the alignments read color functions — the most complex case and where
bugs keep appearing. If the pattern works well, extend to:

1. Alignments CIGAR op colors (gap, mismatch, insertion, softclip, hardclip)
2. Coverage colors
3. Variant cell colors
4. Wiggle bin colors
5. Canvas feature colors

Each display's color logic is independent, so they can be migrated one at a
time.

### What this does NOT become

This is not a general-purpose shader compiler. It doesn't handle:

- Vertex/fragment shader structure
- Buffer bindings or memory layout
- Texture sampling
- Coordinate transforms
- Geometry generation

Those remain hand-written in each shader language. The shadergen only covers the
pure-function color computation that's currently copy-pasted across backends.

## Adjacent problem: uniform buffer layout

The shadergen covers logic duplication, but there is a second class of bug:
**uniform buffer byte sizes and field offsets are hand-declared in TypeScript
and must match the WGSL/GLSL struct layout.** WGSL struct layout rules are
subtle (`vec3<f32>` has align 16 but size 12; struct size rounds up to max
member alignment), and GPU backends may require more padding than the spec
minimum. A mismatch causes WebGPU validation errors that silently freeze
rendering.

The HAL (`webgpuHal.ts`) mitigates this by exposing the full
`alignedUniformSize` (typically 256 bytes) in bind groups, so the GPU binding
can never be "too small." But the JS-side field offsets
(`uniformF32[4] = canvasHeight`) are still manual and fragile.

A build-time tool like **wgsl_reflect** (TypeScript, parses WGSL, extracts
struct member offsets/sizes/alignments) could auto-generate the offset constants
from the WGSL source, making the TypeScript offsets correct by construction.
This is complementary to the shadergen — shadergen handles logic sync,
wgsl_reflect handles layout sync.

## Alternatives considered

**naga transpilation (WGSL → GLSL)**: naga can transpile WGSL to GLSL, but the
data access patterns differ (storage buffers vs vertex attributes). Would
require restructuring all shaders to separate data access from logic, and naga's
GLSL output may not match the handwritten quality needed for WebGL2
compatibility. Targets ES 3.10+, not the ES 3.00 we currently use.

**wgsl_reflect (build-time layout extraction)**: TypeScript library that parses
WGSL and extracts struct member names, types, byte offsets, sizes, and
alignments. Could auto-generate UNIFORM_BYTE_SIZE and field offset constants
from the WGSL source at build time. Lightweight, incremental, solves the layout
problem without touching shader authoring. Does not help with WGSL/GLSL/TS logic
sync.

**TypeGPU (Software Mansion)**: TypeScript-first GPU framework where you define
data schemas in TS and it generates WGSL. Has `d.sizeOf()` / `d.alignmentOf()`
for layout computation and an experimental GLSL backend. Pre-1.0 with API churn;
would couple us to their release cycle. Solves both layout and code-gen but
requires rewriting shader authoring. Worth watching but not adopting yet.

**Pre-compute colors on CPU**: Eliminates shader color logic but makes scheme
switching require full instance buffer rebuild (currently just a uniform
update). Also requires plumbing palette data into the RPC worker.

**Template strings**: Writing shader code as TypeScript template strings with
language switches (`lang === 'wgsl' ? 'vec3f' : 'vec3'`). Brittle, hard to read,
no type checking of the shader logic.

**Accept the duplication**: Viable for now (Option G named constants help), but
each new color scheme or override rule requires changes in 3 places. The surface
area grows with each display type that adds GPU rendering.
