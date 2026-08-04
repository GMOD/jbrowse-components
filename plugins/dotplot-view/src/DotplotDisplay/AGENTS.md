# DotplotDisplay

- Dotplot shaders are authored in `shaders/dotplot.slang` and generated into
  `shaders/dotplot.generated.ts` via `pnpm gen:shaders`. The generated module is
  the single source of truth for WGSL, GLSL ES 300, instance stride, field
  offsets, and GL attribute layout. See
  `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md`.
- **The plot-wide opacity slider is the `alpha` uniform, not part of the packed
  color.** `dotplotColors.ts` packs every color fully opaque; the fragment does
  `color.a * u.alpha`, and `drawDotplotInstances` folds the same scalar into its
  `rgba()` string (`ctx.globalAlpha` is not an option — SvgCanvas, the SVG
  export target, doesn't implement it). Baking it in made one drag frame
  recompute the colors array, re-pack every instance and re-upload the buffer.
  Same split as the synteny renderer's `fillShade`.
- `instanceInterleave.ts` owns the pack loop and the `patchInstanceColors`
  recolor fast path, keyed in `GpuDotplotRenderer.getInterleaved` on
  `(x1 identity, colors identity)`. It is deliberately the twin of
  `LinearSyntenyDisplay/instanceInterleave.ts` — same two exports, same reason
  for not using the generated `packInstances` (both apply a per-element
  transform: here `cumBp - base`, there `instanceFeatureIdx + 1`).
- Geometry stays **absolute Float64 cumBp** (`buildLineSegments`) so the
  Canvas2D and SVG paths read it directly; the window-relative Float32
  conversion happens at GPU upload only. Synteny bakes it in the worker instead.
  See `agent-docs/reference/BP_PRECISION.md` §"Synteny + dotplot".
