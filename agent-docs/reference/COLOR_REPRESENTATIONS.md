---
name: color-representations
description: The six representations a color passes through between a config slot and a pixel, the ~20 functions that cross between them, and why two of them share the `number` type with incompatible byte layouts. Read before adding a color path.
audience: internal
kind: spec
---

# Color representations: a concept that does not collapse

Most cross-cutting concepts here funnel many branches into a few values a consumer
reads ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md), [TRACK_REGISTRATION.md](TRACK_REGISTRATION.md)).
Color does not: two representations share the runtime type `number` with
incompatible byte layouts, and the type system cannot tell them apart. The GPU
renderer rollout added the second layout to a domain that already had one, without
adding a way to distinguish them.

| Code | Path |
| --- | --- |
| Vendored canonical-layout library (`0xRRGGBBAA`, R in the high byte) | `packages/core/src/util/color-bits/` |
| ABGR u32 layout, BED-triple handling, the invalid-color sentinel | `packages/core/src/util/colorBits.ts` |
| `colord`-API compat shim over the canonical layout | `packages/core/src/util/colord.ts` |
| Named-color table, contrast/emphasis helpers | `packages/core/src/util/color/` |
| The documented hazard, not yet a fix | `CORE_UTIL_AUDIT.md` § "Kept on purpose" |
| GPU shader-side unpack, the ABGR layout's other end | `packages/render-core/src/shaders/colorPack.slang` (`unpackRGBA()`) |

`color-bits/core.test.ts` and `clamping.test.ts` pin the byte math;
`colorBits.test.ts` pins the contract that a broken config reads as the magenta
sentinel, never a plausible wrong color. No test asserts which u32 layout a call
site holds, because no type can express it.

## The six representations

1. **CSS text**: a config slot, a JEXL return value, or a raw BED
   `itemRgb`/`reserved`/`field8` attribute (hex, `rgb()`/`hsl()`/`color()`, a
   named color, or a bare `"255,0,0"` triple that `featureBedColor` folds into
   `rgb(...)` first).
2. **The canonical packed `Color`**: a `number` in `0xRRGGBBAA`, the vendored
   `color-bits` domain. Every `blend`/`darken`/`lighten`/`alpha`/`getLuminance`
   lives here only.
3. **The ABGR-packed u32**: a `number` with red in the *low* byte, the layout GPU
   instance buffers and canvas `fillStyle` round-trips write (`colorBits.ts`).
4. **A normalized `[0,1]` float triple/quad**: a shader *uniform* (not a
   per-instance attribute).
5. **Plain `{r,g,b,a}` / `{h,s,l,a}` objects**: `toRGBA`/`toHSLA`, for pickers and
   inspectors.
6. **The `Colord` façade**: wraps (2) with `colord()`'s API for code migrated from
   the npm package.

## The conversion graph

Same-domain math (`alpha`, `darken`, `blend`, `withAbgrAlpha`) stays inside one
representation. Cross-representation functions:

| From → To | Functions |
| --- | --- |
| CSS → canonical | `parse`, `parseColor`, `parseHex` (vendored); `parseCssColor`, `parseCssColorOr` (adds named colors, BED triples, `transparent`, fallback) |
| canonical → CSS | `formatHEX`, `formatHEXA`, `formatRGBA`, `formatHSLA` |
| canonical → object / triple | `toRGBA`, `toHSLA`; `toGLrgb` |
| CSS → triple / ABGR / 0..255 | `cssColorToNormalizedRgb(a)`, `cssColorToABGR`, `cssColorToRgb(a)` (each parse, then convert) |
| ABGR ↔ CSS / canvas | `abgrToCssRgba`, `setAbgrFill` |
| triple → ABGR / CSS | `normalizedRgbToABGR` (**opaque alpha only**), `normalizedRgbToCss(Rgba)` |
| → / from `Colord` | `colord()`; `.toHex()`, `.toRgbString()`, `.toHsl()`, `.toHslString()`, `.toRgb()` |

Three edges that would complete the graph do not exist:

- **ABGR → canonical `Color`**: a caller holding a GPU-domain u32 who needs any
  color math has only `abgrToCssRgba` then `parseCssColor`, a string round-trip
  for what should be a byte reorder.
- **ABGR → normalized triple**: same gap.
- **canonical `Color` → ABGR**: only `cssColorToABGR`, which starts from a CSS
  string; its body holds the one `packAbgr(getRed(c), getGreen(c), getBlue(c),
  getAlpha(c))` idiom. Swapping a `getRed`/`getBlue` for `abgrRed`/`abgrBlue` goes
  silently wrong because both accessor families share the signature
  `(c: number) => number`. `CORE_UTIL_AUDIT.md` rejected a branded type: read back
  from a `Uint32Array`, an ABGR value is a bare `number`, so a brand would be cast
  away at every read.

## Verdict: does not collapse

What a call site holding a `number` must know is **one bit**: canonical or ABGR
byte order. Every other representation carries its own type. Nothing enforces the
bit; each ABGR accessor caller outside `core` trusts a comment, a variable name or
the surrounding shader-packing code that its `number` is in that order and not the
canonical one a config-side `parseCssColor` produced.

The missing piece is not the branded-type fix but a single audited `Color → ABGR`
entry point for a `Color` already in hand. It would close the more dangerous
missing direction, the one that runs at every GPU-path color write, without
solving the type-level ambiguity.
