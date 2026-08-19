---
name: deferred-architecture-review
description: The chrome loose end left after the bring-your-own-chrome pass, and the custom-display page that would answer "can I draw my own visualization", blocked on `render-core` being unpublished.
---

# Deferred architecture-review items (type-safety / DisplayChrome)

Deliberately left for a decision after the 2026-07 architecture-review fix pass
(the code + doc fixes landed; `viewportMatchesLastDrawn` freshness gate, the
clipPath-id and byte-limit fixes, etc.). The dotplot/circular export-freshness
gap from the same pass is tracked in TODO.md.

- **DisplayChrome prop/height parity.** (a) `{...divProps}` spread only on the
  ready branch, so terminal early-returns drop ref/handlers — already documented
  as benign-by-design (ADR-025); (b) `TooLargeMessage` renders at intrinsic
  height while `DisplayRenderErrorOverlay` gets `height={model.height}`.
  Threading height through `TooLargeMessage`→`BlockMsg` could churn many
  displays' too-large snapshots and the intrinsic height may be intentional —
  needs a product call.
- **Make `dataCurrent` a required member** (omission = compile error, not a
  runtime export hang). MST mixin composition doesn't enforce "must override a
  getter" cleanly, and [ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)
  rules out the composition trick that would express it. Deferred; the default
  is fail-hung rather than fail-stale, which is the safe side.
- **The chrome could own the container `height`.** Four displays still pass
  `style={{ height: model.height }}` to `DisplayChrome` (maf, multi-sample
  variant, multi-row feature, basic feature), which already takes the model and
  already supplies `position: relative` as a caller-overridable default in the
  same object literal. It was eleven when this was written; the shrinkage is
  other work happening to touch them, not this item being taken.

  Parked because **this is duplication, not drift** — every one is
  `model.height`, so unlike `canvasWidthPx` there is no second spelling to
  disagree later. The two that would newly *gain* a height are the two where the
  absence looks deliberate: alignments uses `minHeight: '100%'`, and arc's
  `DisplayStatusChrome` passes no style and sizes intrinsically. Do those two
  first, with a browser check; the rest are the easy part.

### One loose end from the bring-your-own chrome pass

The idea this heading used to carry — a theme-free `makeStyles`, the
build-your-own "weight" half — **shipped on 2026-08-06**. `makeStyles` hands a
component `ui/styleTheme.ts`'s plain-data theme and reaches no Material UI;
[reference/EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md), "Theme-free
`makeStyles`", has the census behind the design and the measurement, and the
section after it has what is left, which is not what this proposal predicted.

The scrollbar-clearance half of what did not travel with it **shipped on
2026-08-07**: alignments' bottom-right row reserved nothing for its
`VerticalScrollbar` while canvas reserved 14, and the number was a private copy
in each file. `VERTICAL_SCROLLBAR_WIDTH` is exported from `ui/VerticalScrollbar`
now and both pass `VERTICAL_SCROLLBAR_WIDTH + 2`, which leaves canvas's pixel
value exactly where it was (its 14 was a deliberate hairline, not a stale copy)
and moves alignments' chips off the thumb. The PNG churn that argued for leaving
it alone lands in the weekly non-gating figures sweep, with a BEFORE/AFTER to
read it against, rather than in CI.

What is still true from that pass: `plainTrackControl` carries one literal colour
(`#d97706`) because there is no CSS system colour for "something is wrong" and
the warning state exists precisely to be seen without hovering.

**The examples site still cannot demonstrate the seam, and that was assessed
rather than assumed.** `DisplayChromeBase` takes `model: ChromeModel &
RenderLifecycleModel<B>` plus a backend `factory`, so a page showing it needs a
display *model* — a config schema, a display type and a plugin to register them,
on top of the ~300 lines of view boilerplate every page there repeats. Most of
the file would be about how to write a display rather than about the seam, and
the site's "one page adds one thing" arc has nowhere to put it. If it ever gets a
demo it belongs outside the arc, and the honest scope is a custom-display page
that happens to use `DisplayChromeBase` — not a `DisplayChromeBase` page.

### A custom-display page, and the packaging that blocks it

Reframed 2026-08-11, and the reframing is the useful part. The paragraph above
scopes this as a chrome demo, which undersells it. The question an embedder
actually arrives with — sharpened by the GPU rearchitecture, which from outside
reads as *everything is a hardcoded shader now* — is **"can I draw my own
visualization at all?"** Nothing on any of the four sites answers it, and the
answer is much better than the architecture looks.

**No shaders are involved, and that is measured rather than hoped.**
`createCanvas2DBackend` (`packages/render-core/src/createRenderingBackend.ts`)
is a first-class Canvas2D-only path: it skips the HAL ladder outright and
"plugs into the exact same `RenderLifecycleMixin` / `DisplayChrome` machinery as
a GPU display — the lifecycle is backend-agnostic, so nothing downstream knows
or cares there's no HAL." Its own guidance is to promote to the dual GPU path
only once a profile shows Canvas2D cannot hold 60fps at real feature counts
(≳100K features/frame, RFC-001 §3a). Five display families already take it —
sequence, gwas, hic, maf, synteny — and the draw functions are small:
`Canvas2DSequenceRenderer.ts` 37 lines, `HicRenderer.ts` 19,
`Canvas2DManhattanRenderer.ts` 117. A Manhattan plot is ~120 lines of `ctx`
calls on the same engine, which is a far stronger page than anything about
chrome.

**The blocker is packaging, not difficulty.** `@jbrowse/render-core` is
unpublished — 404 on the npm registry, despite carrying a version and being a
workspace dependency of `plugins/linear-genome-view` and `jbrowse-web` — and it
is absent from `ReExports/modules.ts`, so it is not on the runtime-plugin ABI
either. That bites from both directions at once:

- an examples-site page importing it would build inside the monorepo and be
  **un-pasteable** by a reader, which breaks the one inviolable rule of those
  sites (an example may import only from published packages);
- an external runtime plugin cannot reach it at all.

So this is not a "write the page" decision, it is **do we want custom displays
to be a supported public extension point?** If yes, the work is: publish
`render-core`, or re-export the needed surface through `@jbrowse/core`, plus the
`abiBaseline.json` entry — and then the page is straightforward and the shader
boilerplate never enters it. If no, the page cannot honestly exist on those
sites, because the reader could not run what it shows.

**`@jbrowse/display-ui` joins that list if the answer is yes, and for a sharper
reason than reach.** It holds three React contexts (the two chrome seams and
`TrackOverlayContext`), and a context is only a seam if both sides hold the same
module instance. A runtime plugin that bundles its own copy gets its own
contexts: the host's `DisplayUIProvider` silently fails to reach its display, and
what the user sees is Material chrome inside an app that mounted the plain set.
So the package needs a `ReExports/modules.ts` entry at the same time as
`render-core`, not later. Nothing needs it today, since a runtime plugin cannot
write a display at all.

Unmeasured, and worth doing before committing: the **state model** is the real
bulk of a display, not the renderer (gwas's is 689 lines, though much of that is
LD-specific). Size a genuinely minimal display first; the ~120-line figure above
is the drawing only.
