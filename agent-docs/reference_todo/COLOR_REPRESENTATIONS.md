---
name: color-representations
description: One-page spec (release-validation method) for the packed-color concept — the six representations a color travels through between a config slot and a drawn pixel (CSS string, the vendored color-bits canonical u32, the GPU-facing ABGR u32, a normalized float triple, plain RGBA/HSLA objects, and the `colord` UI facade) and the ~20 named functions that cross between them. Unlike REGION_TOO_LARGE.md and TRACK_REGISTRATION.md, this one does not collapse cleanly: two of the six representations share the exact runtime type (`number`) with incompatible byte layouts, the type system cannot tell them apart, and the conversion graph has no edge back from the GPU layout to the domain every color-math operation lives in. Read before adding a color path, or before believing "call the accessor" is enough of a contract.
---

# Color representations: a concept that does not collapse

Most of this repo's cross-cutting concepts turn out to be a large branch count
funneling into a small number of values a consumer actually reads —
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) (73 states to 7) and
[TRACK_REGISTRATION.md](TRACK_REGISTRATION.md) (32 to 4) are both that shape.
Color is not: the graph a color travels through has a hole in it, the hole is
along the one axis the type system cannot check, and the file/line growth this
spec was chosen for (18 → 74 consumer files, 301 → ~1,950 implementation
lines since `v4.3.0`, spread across nine plugins/packages) is the GPU renderer
rollout adding a whole new representation to a domain that already had one,
without adding a way to tell the two apart at the type level.

| Code | Path |
| --- | --- |
| Vendored canonical-layout library (`0xRRGGBBAA`, R in the high byte) | `packages/core/src/util/color-bits/{core,parse,format,functions,convert,bit}.ts` |
| ABGR u32 layout, BED-triple handling, the invalid-color sentinel | `packages/core/src/util/colorBits.ts` |
| `colord`-API compat shim over the canonical layout | `packages/core/src/util/colord.ts` |
| Named-color table, contrast/emphasis helpers | `packages/core/src/util/color/{cssColorsLevel4,makeContrasting,emphasize,randomColor}.ts` |
| The documented hazard, not yet a fix | `agent-docs/reference/CORE_UTIL_AUDIT.md` § "Open: structural" |
| GPU shader-side unpack, the ABGR layout's other end | `packages/render-core/src/shaders/colorPack.slang` (`unpackRGBA()`) |

Tests: `color-bits/core.test.ts`, `clamping.test.ts` pin the vendored library's
byte math; `colorBits.test.ts`'s documented contract is that a broken config
reads as the magenta sentinel, never a plausible wrong color. No test asserts
anything about which of the two u32 layouts a given call site is holding —
there is no type for that to check.

## The six representations

A color moving from a track's config slot to a drawn pixel passes through as
many as six distinct forms:

1. **CSS text** — a config slot, a JEXL callback's return value, or a raw BED
   `itemRgb`/`reserved`/`field8` feature attribute (`#rgb`, `#rrggbb(aa)`,
   `rgb()`/`rgba()`/`hsl()`/`hsla()`/`color()`, a named color, or a bare
   `"255,0,0"` triple `featureBedColor` recognizes and folds into a synthesized
   `rgb(...)` string before it reaches the parser).
2. **The canonical packed `Color`** — a `number` in `0xRRGGBBAA` layout (red in
   the high byte), the vendored `color-bits` library's entire domain: every
   `blend`/`darken`/`lighten`/`alpha`/`getLuminance` operation lives here and
   nowhere else.
3. **The ABGR-packed u32** — a `number` in the *opposite* byte order (red in
   the low byte), the layout GPU instance buffers and canvas `fillStyle`
   round-trips actually write, defined in `colorBits.ts` alongside the
   canonical layout it is not compatible with.
4. **A normalized `[0,1]` float triple/quad** — the shape a WebGL/WebGPU
   shader *uniform* (as opposed to a per-instance vertex attribute) expects.
5. **Plain `{r,g,b,a}` / `{h,s,l,a}` objects** — `toRGBA`/`toHSLA`, the shape a
   color picker or an "About track" inspector reads.
6. **The `Colord` façade** — an object wrapping (2), offering `colord()`'s
   `mix`/`darken`/`lighten`/`toHex`/`toRgbString` API for UI code migrated from
   the real `colord` npm package without touching every call site.

## The conversion graph: ~20 named edges, one missing direction

Counting every exported function that crosses one of these six forms into
another (not the same-domain math — `alpha`/`darken`/`lighten`/`blend`/
`getLuminance` stay inside representation 2, `withAbgrAlpha` stays inside 3):

| From → To | Functions | Count |
| --- | --- | --- |
| CSS → canonical `Color` | `parse`, `parseColor`, `parseHex` (vendored); `parseCssColor`, `parseCssColorOr` (adds named colors, BED triples, `transparent`, fallback-on-throw) | 5 |
| canonical `Color` → CSS | `formatHEX`, `formatHEXA`, `formatRGBA`, `formatHSLA` | 4 |
| canonical `Color` → object | `toRGBA`, `toHSLA` | 2 |
| canonical `Color` → normalized triple | `toGLrgb` | 1 |
| CSS → normalized triple | `cssColorToNormalizedRgb`, `cssColorToNormalizedRgba` (parse, then normalize — composite) | 2 |
| CSS → ABGR | `cssColorToABGR` (parse, then pack — composite) | 1 |
| normalized triple → ABGR | `normalizedRgbToABGR` (**opaque alpha only** — cannot round-trip an input alpha) | 1 |
| normalized triple → CSS | `normalizedRgbToCss`, `normalizedRgbToCssRgba` | 2 |
| ABGR → CSS | `abgrToCssRgba` | 1 |
| CSS/HSL-object → `Colord` | `colord()` (wraps (1)) | 1 |
| `Colord` → CSS / object | `.toHex()`, `.toRgbString()`, `.toHsl()`, `.toHslString()`, `.toRgb()` | (5, not separately tallied — one façade) |

**Twenty** named cross-representation functions, over six nodes. Three edges
that would complete the graph do not exist:

- **ABGR → canonical `Color`**: nothing. A caller holding a GPU-domain u32
  that needs `blend`/`darken`/`lighten`/`getLuminance` — every color-math
  operation this codebase has — has no function to call. The only way there is
  `abgrToCssRgba` then `parseCssColor`, a full string round-trip for what
  should be a byte reorder.
- **ABGR → normalized triple**: nothing, same gap.
- **canonical `Color` → ABGR**: no single named function either. The idiom
  every ABGR-producing call site actually uses is
  `packAbgr(getRed(c), getGreen(c), getBlue(c), getAlpha(c))` — four channel
  reads through the canonical-layout accessors, then a re-pack — which is
  exactly the operation that goes silently wrong if a `getRed`/`getBlue` pair
  is swapped for `abgrRed`/`abgrBlue`, because both accessor families share
  the signature `(c: number) => number` and nothing distinguishes a canonical
  `Color` from an ABGR `number` at the type level. `CORE_UTIL_AUDIT.md`
  documents the swap hazard and the branded-type fix it rejected — read back
  from a `Uint32Array` (a GPU instance buffer element), an ABGR value is a bare
  `number` by the time any function sees it, so a brand would need casting
  away at every read, defeating itself.

## What a consumer can actually tell apart: one bit, unchecked

Collapse the six representations by what a call site holding a `number` in
hand actually needs to know before it can act on it correctly: not which of
six named forms it is, but **which of the two incompatible u32 byte orders**
— canonical or ABGR. Every other representation (CSS, the normalized triple,
the plain objects, `Colord`) carries its own type (`string`, a 3/4-element
array, an object, a class instance) and cannot be confused with anything else
at a glance. The two `number`-typed layouts can, and are read by accessor
families with identical signatures.

So the concept a consumer distinguishes is genuinely **one bit** — and
nothing enforces it. `git grep` finds 40 non-test files across nine
plugins/packages (`alignments`, `canvas`, `dotplot-view`, `gwas`,
`linear-comparative-view`, `maf`, `variants`, `wiggle`, `synteny-core`) calling
the ABGR accessor family directly, each trusting by convention — a code
comment, a variable name, the shape of the surrounding shader-packing code —
that the `number` it was handed is actually in that byte order and not the
canonical one a config-side `parseCssColor` call two functions up the stack
produced.

## Verdict: does not collapse — this is the finding

Where the region-too-large gate and track registration both turn out to be
more branches than states, color has the opposite shape: few representations,
a small conversion graph, and it still fails to collapse to something a type
signature can hold a call site to. The failure mode is specific and
real, not a hypothetical: two representations occupy the same runtime type,
one direction of conversion between them has no named function (so every
call site re-derives the ABGR-from-canonical idiom by hand instead of calling
one audited helper), and the opposite direction does not exist at all. The
growth this spec was picked for — the GPU rendering rollout since `v4.3.0`
adding representation 3 and 4 wholesale to a domain that already had 1 and 2 —
is exactly how a second incompatible layout with the same runtime type gets
introduced without anyone deciding it needs to be told apart from the first.

`CORE_UTIL_AUDIT.md` already named this ("the wrong pair silently swaps R and
B") and already rejected the branded-type fix for a documented, structural
reason — the fix is genuinely hard, not overlooked. What is missing is not a
fix but the two edges that would make the existing convention (comments,
naming, "both families now cross-reference each other") into something the
graph itself enforces: a single audited `Color → ABGR` function (replacing the
40-site `packAbgr(getRed(c), …)` idiom with one call this doc can point a
reader at) closes the more dangerous of the two missing directions — the one
that runs at every GPU-path color write, not just the rare read-back — even
without solving the type-level ambiguity CORE_UTIL_AUDIT.md left open.
