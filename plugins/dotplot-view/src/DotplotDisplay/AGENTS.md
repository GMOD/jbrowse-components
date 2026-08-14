# DotplotDisplay

- Dotplot shaders are authored in `shaders/dotplot.slang` and generated into
  `shaders/dotplot.generated.ts` via `pnpm gen:shaders`. The generated module is
  the single source of truth for WGSL, GLSL ES 300, instance stride, field
  offsets, and GL attribute layout. See
  `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md`.
- **The AA ramp is `0.5/dpr` CSS px and the vertex quad is padded by the same
  amount.** The shader measures in CSS px while the viewport is device px, so
  the ratio arrives as a uniform (`devicePixelRatio`) — the same constant, for
  the same reason, as `syntenyTypes.slang`'s `aaHalfPx`. It is analytic, not
  `fwidth(d)`: `d` is a true Euclidean distance so `|grad d| = 1` and there is
  nothing to measure, while `fwidth` overshoots by up to sqrt(2) on exactly the
  diagonals a dotplot is made of. The two halves are one change — a ramp the
  quad doesn't contain gets cropped at 50% alpha, which is a hard aliased edge.
  `shaders/dotplotCapsulePad.test.ts` pins the containment and the
  counterexample; it is the twin of
  `LinearSyntenyDisplay/shaders/syntenyFillPad.test.ts`. Change either half, run
  it.
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
- **`DotplotDisplayModel` and `DotplotViewModel` are
  `interface … extends Instance<…>`, never `type … = Instance<…>`.** `self.view`
  names the view and the view's `dotplotDisplays` names this display back; the
  interface form is what defers that mutual reference. As a type alias the pair
  collapses — TS7023 on the factory, TS2456 on the alias, then a burst of
  implicit-any errors in a dozen unrelated files, which is what the failure
  looks like from the outside. Don't "fix" that by duck-typing the view. See
  ADR-055.
- **The hover pick is on the model, and its index needs no invalidation.**
  `dotplotPickEngine` indexes FEATURE hulls in absolute cumBp, keyed in a
  WeakMap on `instanceData.x1` — the same geometry token
  `DOTPLOT_INSTANCE_CACHE` uses. A pan doesn't rebuild dotplot geometry and a
  zoom does, so nothing here needs `syntenyPickEngine`'s `isIndexUsable` /
  `MAX_PAN_SKEW_PX`; the pan enters through the query transform instead. Two
  further deliberate differences from that twin: it answers **nearest**, not
  topmost (thin lines, not opaque fills), and its exact test measures in **px**,
  because the two axes are independently scaled. Nothing calls into a rendering
  backend, so hover survives the Canvas2D fallback and a lost GPU context.
- **Hover shading is `hoveredFeatureHighlight` + `DotplotHoverHighlight`, not a
  shader uniform.** Restroking the one hovered feature over the canvas is
  backend-agnostic by construction — it never asks which backend painted — where
  synteny's uniform route costs an instance lane, a uniform, a hand-written
  Canvas2D twin of `fillShade`/`hoverDarken` (not importable across plugins
  anyway, and its fragment output is straight alpha where dotplot's is
  premultiplied), and a broken color run in `drawDotplotInstances`' batcher. It
  is on-screen only: `renderSvg` doesn't draw it, since an off-screen export has
  no pointer.
- **A display getter that reads `this.view` needs an explicit return type.**
  Every one of them has one, and an inferred one collapses the view/display
  mutual reference — TS7023 on the factory, TS2310 on `DotplotDisplayModel`,
  then implicit-anys across the plugin and `products/jbrowse-img`. That is what
  `DotplotHoverHighlight` in `types.ts` is named for. ADR-055.
- Geometry stays **absolute Float64 cumBp** (`buildLineSegments`) so the
  Canvas2D and SVG paths read it directly; the window-relative Float32
  conversion happens at GPU upload only. Synteny bakes it in the worker instead.
  See `agent-docs/reference/BP_PRECISION.md` §"Synteny + dotplot".
