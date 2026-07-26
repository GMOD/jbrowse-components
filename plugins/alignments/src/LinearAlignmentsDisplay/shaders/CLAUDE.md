# Alignments shaders

## Module layering

`alignmentsUniforms.slang` is the single shared utilities module. Every pass
shader imports it and gets access to:

- `bpToClipX(uint bp, Uniforms u)` / `bpToLinear(uint bp, Uniforms u)` —
  canonical bp→clip/linear converters. **Always use these, never call
  `hpClipX(hpSplitUint(...), u)` directly.** The uint argument type makes it
  impossible to accidentally pass a pre-split float2.
- `ColorVsOut` — shared vertex output struct for passes that only need
  `position + color`. Passes with extra varyings (read, arc, indicator, overlap)
  define their own.
- `frequencyAlpha(base, freq)` — sub-pixel alpha blend used by mismatch / gap /
  insertion / clip. Mirrors `frequencyAlpha()` in `rendererTypes.ts`.
- `discardVertex()` — returns a zero-position `ColorVsOut` to cull degenerate
  instances (alpha == 0) without branching in the fragment shader.
- `covBarScale(relDepth, u)` — coverage bar height scale shared by snpCoverage
  and modCoverage.
- `pileupY`, `pileupRowTopPx`, `pileupRowCenterPx`, `flipX`, `expandMinWidthX`,
  `hueRampHalfSat`, `normalizeDepth`, `clipKindColor`, etc.
- `TRIANGLE_HW` / `TRIANGLE_H` — the coverage-strip clip indicator triangle.
  `indicator` draws it and `interbaseHistogram` hangs its bars directly below
  one, so the height has to be one constant, not a copy per pass.

## Import discipline

Only import what a shader calls **directly**. In particular:

- `import hpmath` — only needed if the shader calls `quadLocal`, `snapToPixelX`,
  or another hpmath symbol directly. Shaders that only use `bpToClipX` /
  `bpToLinear` do **not** need `import hpmath`; the split is hidden inside those
  wrappers.
- `import colorPack` — only needed for direct `unpackRGBA` calls. Shaders that
  reach color only through `clipKindColor` (defined in `alignmentsUniforms`) do
  not need it.
