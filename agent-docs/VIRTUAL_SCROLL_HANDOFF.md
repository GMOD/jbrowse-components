# Virtual-scroll unification — handoff

Status as of this handoff: the migration and cleanups are **committed and
working**; two follow-ups remain (a snapshot regen and one in-browser check).

## What this was

The canvas GPU displays used to scroll a `position:sticky` canvas inside a
native `overflow:auto` container, with DOM overlays (labels/highlights) riding
the native scroll. That created **two scroll coordinate spaces** — the DOM's
compositor `scrollTop` and the main-thread `model.scrollTop` the canvas paints
from — so on a fast scroll the overlays tore away from their glyphs. The fix was
to unify every canvas GPU display onto the **virtual-scroll** paradigm (single
source of truth = `model.scrollTop`): a fixed `position:absolute` canvas, a
`VerticalScrollbar` overlay + `useVirtualScrollWheel`, and DOM overlays
translated by the same `model.scrollTop`. Tearing is now impossible by
construction (same design alignments already used).

## Committed (all on `webgl-poc`)

- Original tearing diagnosis + `ScrollLockedOverlay` primitive extraction into
  `@jbrowse/render-core` + the render-core CLAUDE.md invariant.
- `3bcbb053c9` migrate multi-sample regular display (`VariantComponent`) to
  virtual scroll; delete dead `useVariantNativeScroll`; add `VerticalScrollbar`
  `data-testid="vertical-scrollbar"`.
- `c573812e3e` fix "scrollbar jumps on zoom": `clearDisplaySpecificData` was
  zeroing `scrollTop` on same-region refetch; moved that reset to the
  displayed-regions-change handler (chromosome-nav only). (This commit also
  carried another agent's in-flight `pinnedFeatureIds` work — shared worktree.)
- `c6997523db` convert `LinearBasicDisplay` (`FeatureComponent`) to virtual
  scroll (committed by a parallel agent; it's my code).
- `c673d7a0a8` regenerate the variant assembly-aliases snapshot goldens
  (canvas2d + webgl) for the scrollbar/overlay visual change.
- `71b4a8fd00` drop dead code the migration orphaned: `focusScrollDelta`
  (+ tests) and `useScrollTopSync`.
- `0061cc6c79` click-to-page on the `VerticalScrollbar` track.
- `e7f25a98af` centralize `contentHeight`/`scrollableHeight` model getters; drop
  the dead `morphScrollFrom`/`morphScrollDelta` scroll-easing (feature-follow is
  disabled — the only remaining repack scroll move is an instant shrink-clamp).

Key files: `packages/render-core/src/ScrollLockedOverlay.tsx`,
`packages/core/src/ui/VerticalScrollbar.tsx`,
`packages/core/src/util/useVirtualScrollWheel.ts`,
`plugins/canvas/src/LinearBasicDisplay/components/FeatureComponent.tsx`,
`plugins/canvas/src/LinearBasicDisplay/baseModel.ts`,
`plugins/variants/src/LinearMultiSampleVariantDisplay/components/VariantComponent.tsx`.

## Open follow-ups

1. **In-browser check for `e7f25a98af` (medium priority).** The morph now
   applies the shrink-clamp instantly instead of easing it over 300ms. This only
   triggers when you're scrolled near the bottom of an overflowing track and
   zoom **in** (content de-stacks, shrinks below the current scroll). Verify the
   instant snap isn't perceptibly jarring; if it is, restore the eased version
   (git show `e7f25a98af` for the removed code). Unit tests already cover
   correctness (no strand/blank) — this is purely an aesthetics check.

2. **Regenerate the remaining canvas snapshot goldens (blocked earlier by
   concurrent edits; now unblocked).** A full canvas2d suite run showed 15
   failures. Most are **not** from this migration and should be left to their
   owners: BigWig GC content (84%) / GC skew (14%) — a gccontent/wiggle change;
   BEDPE arcs, alignments (linked-read/methylation), Hi-C (~1%, near-flaky),
   wiggle-color timeout, sequence-display selector. The ones in scope here are
   the **LinearBasicDisplay / variant** goldens whose rendering is now settled:
   - `demo-hg19-gene-glyph` (label shift from this migration + committed chevron
     changes from `921648ba08`)
   - `additional-multisample-vcf` (verify first — its diff was a whole-matrix
     change that looked like a *variant-rendering* change, not scroll; only
     regenerate if that's settled/intended).

   Regenerate with: `cd products/jbrowse-web && pnpm --filter @jbrowse/web build`
   then `DISPLAY=:0 node browser-tests/runner.ts --filter="<suite>" --test="<name>" -u`
   (and `--backend=webgl -u` for the webgl golden — GPU-deterministic on this
   box, but goldens are GPU-sensitive so ideally regen on canonical hardware).

## Declined / out of scope (agreed with user)

- **Label windowing** — not added. "Build once, composite-scroll" is
  deliberately cheaper per frame than windowing; `maxHeight` keeps content under
  element-height limits. Verified labels track scroll *exactly* (a 40px scroll
  moves labels 40px, preserving spacing), so no accuracy issue.
- **Keyboard scrolling** (PageUp/Down/Home/End/arrows + focus) — a real a11y
  parity regression vs native scroll, but a new feature; logged, not built.

## Gotchas / notes

- **Shared worktree.** `baseModel.ts` / `FeatureComponent.tsx` were repeatedly
  co-edited by other agents (pinnedFeatureIds pinning, hoveredRegionIndex,
  feature-admission solo, `>>` chevrons). Several of my commits necessarily
  rode along with or were committed by those agents. Scope commits to explicit
  pathspecs and re-check `git diff` for foreign hunks before committing here.
- The old regression test technique (freeze `requestAnimationFrame`, set native
  `container.scrollTop`, assert overlay doesn't move) is **obsolete** now that
  there's no native scroll container. The current guard is
  `assertVirtualScrollStructure` in `browser-tests/helpers.ts` (canvas absolute,
  no native scroller, outer overflow hidden), used by the two variant suite
  tests. `page.mouse.wheel` doesn't reach the non-passive canvas wheel listener
  in headless — dispatch a `WheelEvent` directly to the canvas to test wheel
  scroll; scrollbar drag / click work normally.
