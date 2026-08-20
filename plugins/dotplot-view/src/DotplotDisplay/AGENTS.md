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
- `instanceInterleave.ts` owns the pack loop and declares the recolor fast path
  (`DOTPLOT_INSTANCE_CACHE`, which `createInstanceCache` runs), keyed on
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
- **Payload and geometry fixtures live in `testUtils.ts`.** Nine suites used to
  hand-roll all fifteen fields of the fetch payload to vary one of them, so
  every new lane was a nine-file mechanical edit. Vary what your test is about
  and let the factory say the rest.
- **The hover pick is on the model, and its Flatbush needs no invalidation.**
  `dotplotPickEngine` indexes FEATURE hulls in absolute cumBp, keyed in a
  WeakMap on `instanceData.x1` — the same geometry token
  `DOTPLOT_INSTANCE_CACHE` uses. A pan doesn't rebuild dotplot geometry and a
  zoom does, so nothing here needs `syntenyPickEngine`'s `isIndexUsable` /
  `MAX_PAN_SKEW_PX`; the pan enters through the query transform instead. Two
  further deliberate differences from that twin: it answers **nearest**, not
  topmost (thin lines, not opaque fills), and its exact test measures in **px**,
  because the two axes are independently scaled. Nothing calls into a rendering
  backend, so it answers with none attached — before the first paint, through an
  unrecovered context loss, and in a test with no canvas. (Synteny's hover is
  not GPU-only either, `gpuRenderingBackend`'s name notwithstanding: that getter
  holds whichever backend is attached and both implement `pick`. The differences
  are that it needs one attached, and that each backend builds its own index.)
- **Hover shading is `hoveredFeatureHighlight` + `DotplotHoverHighlight`, not a
  shader uniform.** Restroking the one hovered feature over the canvas is
  backend-agnostic by construction — it never asks which backend painted — where
  synteny's uniform route costs an instance lane, a uniform, a hand-written
  Canvas2D twin of `fillShade`/`hoverDarken` (not importable across plugins
  anyway, and its fragment output is straight alpha where dotplot's is
  premultiplied), and a broken color run in `drawDotplotInstances`' batcher. It
  is on-screen only: `renderSvg` doesn't draw it, since an off-screen export has
  no pointer.
- **The hover stores a SEGMENT index; the feature is derived from it.** The
  operator under the cursor derives from nothing else, and one alignment's CIGAR
  staircase is a dozen segments the pointer can be on different steps of. That
  makes `instanceData` — not `rpcData` — what the stored index addresses, so
  **both** of its writers drop the hover: `setRpcData` and `setInstanceData`.
  The second is the one that gets missed, because a zoom, a `drawCigar` toggle
  and a `minAlignmentLength` change all renumber every segment WITHOUT a
  refetch, which a feature index would have survived.
- **Two invalidation questions, two answers, and neither is a list of entry
  points.** The pair above is "does the index still address the right segment".
  The other is "is the pointer still over it", and it is `DotplotView`'s
  `setupClearHoverOnPlotMove` — one reaction over `plotTransform`, because the
  canvas has no element travelling with its alignments and a plot that moves
  under a stationary cursor fires no pointer event at all. Spelling it per
  gesture instead is how the wheel got missed while pointerdown and pointerleave
  were both covered. The LGV side reached the same shape from the same bug:
  `installClearHoverOnViewportChange`.
- **`plotTransform` is where the projection numbers come from;
  `dotplotProject.ts` is where the arithmetic lives.** Read `plotTransform`
  rather than `dotplotRenderState` unless you also want `alpha` and `lineWidth`
  — the hover highlight took the latter and rebuilt its path once a frame under
  an opacity drag. `viewHeight` is one of them, so the pick takes the whole
  object and the clear-on-move reaction covers a resize; `dotplotRenderState`
  names the four it wants instead of spreading, because a backend already has
  the plot height from `resize`. Then project with `cumBpToPxH` / `cumBpToPxV`
  rather than writing `viewHeight - (…)` again: draw and pick have to agree
  pixel for pixel or the cursor picks an alignment other than the one it is
  pointing at, and the v-axis flip is the half a fourth copy would get wrong.
  The scalar-primitive shape is not a style choice — a transform-object helper
  costs the Canvas2D loop 1.45x and a projector closure 3.5x, both measured in
  `benches/cumBpProjection.bench.ts` and written up in `REJECTED_IDEAS.md`.
- **The pick's tie-break needs `>`, not `<=`.** Flatbush hands candidates back
  in Hilbert order past `nodeSize` items, so an equidistant EARLIER segment can
  arrive last and take a hit that belongs to the one drawn on top. At or under
  `nodeSize` the sort is skipped and insertion order survives, which is why a
  two-feature fixture cannot see this — `dotplotPickEngine.test.ts` pads to 24.
- **A coordinate read back out of a cumBp round trip is `Math.round`ed off
  `pxToBp`'s `offset`, never `coord0`.** `coord0` floors, which is right for
  what it is for (naming the base under a pixel, including pixels past the end
  of a region) and wrong here: a feature endpoint is an exact integer, the trip
  out to px and back cancels `offsetPx` against itself and lands a hair either
  side of it, and the floor turns half of those into an off-by-one — with WHICH
  half depending on the current zoom, so the same alignment reported two
  different lengths at two zoom levels. `dotplotTooltip.test.ts` carries the
  four zoom/pan pairs that reproduce it; note that `offsetPx: 0` never does,
  which is why the first spelling of that test passed on the broken code.
- **Every coordinate either tooltip prints is 1-BASED**, through
  `assembleLocString` for a span and `pxToBp`'s `coord` for the cursor. The axis
  ruler is 1-based too (`tickLabel` re-adds the 1 `makeTicks` took off), so an
  interbase readout disagreed with the tick right beside it, with the nav box a
  user pastes it into, and with the synteny tooltip. `coord0` stays what
  arithmetic reads — `centerAt`, the highlight bounds — and is not for printing.
- **The tooltip's SHAPE is `comparativeTooltipLines` in synteny-core, not this
  file.** Two locations, inverted, two lengths, the numeric channels, the CIGAR
  operator, the name — in that order, with the last two dropped when absent. The
  pair had drifted twice by the time it was shared (the channels first, then the
  coordinate convention), and each time only one of the two views was fixed. All
  that is decided here is that the sides are called x and y.
- **A display getter that reads `this.view` needs an explicit return type.**
  Every one of them has one, and an inferred one collapses the view/display
  mutual reference — TS7023 on the factory, TS2310 on `DotplotDisplayModel`,
  then implicit-anys across the plugin and `products/jbrowse-img`. That is what
  `DotplotHoverHighlight` in `types.ts` is named for. ADR-055.
- Geometry stays **absolute Float64 cumBp** (`buildLineSegments`) so the
  Canvas2D and SVG paths read it directly; the window-relative Float32
  conversion happens at GPU upload only. Synteny bakes it in the worker instead.
  See `agent-docs/reference/BP_PRECISION.md` §"Synteny + dotplot".
