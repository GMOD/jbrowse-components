---
name: color-representations
description: Which byte layout does a `number` color hold, canonical or ABGR, and where do the color modules live? Read before adding a color path or a GPU color write.
audience: internal
kind: spec
---

# Color representations: a concept that does not collapse

Two color representations share the runtime type `number` with incompatible
byte layouts, and the type system cannot tell them apart. The GPU renderer
rollout added the second layout without a way to distinguish them.

- **Canonical packed `Color`**: `0xRRGGBBAA`, R in the high byte, the vendored
  `packages/core/src/util/color-bits/` domain. Every `blend` / `darken` /
  `lighten` / `alpha` / `getLuminance` lives here only; `colord.ts` is a
  `colord`-API shim over it.
- **ABGR u32**: red in the *low* byte, the layout GPU instance buffers and
  canvas `fillStyle` round-trips write (`packages/core/src/util/colorBits.ts`,
  with BED-triple handling and the invalid-color sentinel). The shader end is
  `unpackRGBA()` in `packages/render-core/src/shaders/colorPack.slang`.
- CSS text, normalized `[0,1]` shader-uniform triples and `{r,g,b,a}` objects
  each carry their own type. `packages/core/src/util/color/` holds the named
  color table and contrast helpers.

`color-bits/core.test.ts` and `clamping.test.ts` pin the byte math;
`colorBits.test.ts` pins that a broken config reads as the magenta sentinel,
never a plausible wrong color. No test asserts which layout a call site holds.

## Rules

- **Nothing enforces the one bit.** Each ABGR accessor caller outside `core`
  trusts a comment, a variable name or the surrounding shader-packing code that
  its `number` is in that order. Swapping `getRed` / `getBlue` for `abgrRed` /
  `abgrBlue` goes silently wrong because both families share the signature
  `(c: number) => number`.
- **`normalizedRgbToABGR` writes opaque alpha only.**
- **Three conversion edges do not exist**: ABGR → canonical, ABGR → normalized
  triple, canonical → ABGR. A caller holding a GPU-domain u32 needs
  `abgrToCssRgba` then `parseCssColor`, a string round-trip for a byte reorder;
  canonical → ABGR goes through `cssColorToABGR`, which starts from CSS text.
- **A branded type was rejected** (`CORE_UTIL_AUDIT.md` § "Kept on purpose"):
  read back from a `Uint32Array`, an ABGR value is a bare `number`, so a brand
  is cast away at every read.

The missing piece is a single audited `Color → ABGR` entry point, which would
close the direction that runs at every GPU-path color write without solving the
type-level ambiguity.
