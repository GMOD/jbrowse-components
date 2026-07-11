# Historical notes

Bugs that shaped the current design, and corrections to earlier writeups. None
of this is current behavior — it's kept so a future reader doesn't re-derive a
wrong story or "fix" something back into a known-bad shape. The live docs state
only the current truth; the *why-it-isn't-otherwise* lives here.

## regionTooLarge banner: no oscillation (correction)

Earlier writeups (and commit `614465dd51`) described a `regionTooLarge`
oscillation — a "flag thrash / invalidate→refetch loop." **That story was
wrong.** Instrumentation shows `setRegionTooLarge` reaches `true` once and
holds; `clearAllRpcData` and `fetchRegions` do not ping-pong, and the fetch
state machine settles. The real failure that motivated the current terminal-state
handling was React reconciliation, not the fetch machinery. The
`FetchVisibleRegions` gate and `ClearBlockingStateOnViewportChange` clear are
real and correct — they just don't loop during a steady too-large state.

## The 50kb→5mb→50kb stuck-banner bug (derived regionTooLarge)

Canvas's derived byte gate reads a *rescaled* estimate
(`estimatedVisibleBytes = bytes × view.visibleBp / byteEstimateVisibleBp`), not
raw `bytes`. Reading raw `bytes` deadlocked: the estimate survived
`clearAllRpcData`, stayed above the limit after zooming back into a small region,
and `FetchVisibleRegions` wouldn't re-estimate while `regionTooLarge` held — so
the banner stuck forever. The rescale is what makes the byte gate a pure function
of the view (like `densityTooLarge` scaling featureCount by `bpPerPx`), so it
self-releases on zoom-in.

## Derived regionTooLarge replaced an imperative clear-and-reset cycle

The imperative `RegionTooLargeMixin` path flipped a volatile flag inside
`fetchRegions` and cleared it on viewport change. That clear-and-reset caused the
banner to flicker off and back on during small zoom/pan moves that didn't
actually cross the threshold. The derived canvas approach (a pure function of
cached stats × current `bpPerPx`) recomputes the same value before and after, so
`ClearBlockingStateOnViewportChange` is a no-op for it and there's no flicker.

## ADR-025 "GPU canvas stays mounted" is superseded

ADR-025's headline was that the GPU canvas must stay mounted. That's superseded:
unmounting is safe *so long as* the transition runs a full dispose→re-init cycle.
`DisplayChrome`'s terminal-state early-`return` unmounts the canvas subtree, which
fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
`stopRenderingBackend()`; force-load remounts and re-inits via the callback ref.
The detached-context bug ADR-025 warns of only happens when the canvas unmounts
*without* disposing. Invariant: mount-lifetime is not required; clean
dispose-on-unmount is.

## In-place-refetch staleness (closed everywhere)

Several displays' `svgReady`/`settled` gates used to resolve on the *first datum*
and stay true through an in-place refetch, so a pan/zoom export captured stale
data. `plugins/arc/CLAUDE.md` and other writeups still describe this as open — it
isn't. Every path now carries a freshness signal: the per-region spatial check
(`viewportWithinLoadedData`), the global `viewportMatchesLastDrawn`, and the
signature compare (`isDataCurrent`) all close the debounce+RPC window. See
`reference/SVG_EXPORT.md`.

## The former ~68.7 Gbp synteny/dotplot ceiling

Synteny + dotplot used to split cumBp into a 4096-bp-aligned Float32 hi/lo pair
(the shape ADR-018 documents), exact only while `cumBp < 2³⁶`, degrading past
that — a ~68.7 Gbp whole-assembly ceiling. The current window-relative Float32
base (`cumBp − fetch-time base`) cancels the genome-scale magnitude, so the cap
is gone and 100+ Gbp genomes render correctly. See `reference/BP_PRECISION.md`
§"window-relative." The old shared helper `hpCornerScreenX` was removed from
`hpmath.slang` once both views dropped it; the LGV in-shader
`hpSplitUint`/`hpToClipX` path was untouched.

## React Compiler × ternary sensitivity (now a style choice)

The terminal branches in `DisplayChrome` were once sensitive to
early-`return`-vs-ternary because `babel-plugin-react-compiler` could memoize a
MobX read on `model`'s stable identity and silently drop an update.
`DisplayChromeInner` now carries `'use no memo'`, so the compiler doesn't compile
it and the early-`return`-vs-ternary choice is purely stylistic. Full analysis +
minimal repro + codebase audit (DisplayChrome was the only compiled observer):
`COMPILER_TERNARY_FINDING.md`.

## SVG-only `renderToCtx` drift (removed pattern)

Displays used to keep a separate SVG-only `renderToCtx` that drifted out of sync
with the on-screen renderer — different bicolor handling, different Y-axis
offsets, different bezier curves, different palettes, each plugin its own flavor.
That pattern is gone: SVG export now runs the same Canvas2D draw functions the
on-screen path uses, through `paintLayer`. See `reference/SVG_EXPORT.md`.
