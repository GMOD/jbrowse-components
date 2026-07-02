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

1. **In-browser aesthetics check for `e7f25a98af` — RESOLVED: keep instant.**
   The morph applies the shrink-clamp instantly instead of easing it over 300ms
   (only when scrolled near the bottom of an overflowing track and zooming
   **in**). User elected to keep the instant clamp — it matches what a native
   scroll container does on content-shrink (no easing there either), so it's the
   more conventional behavior. Correctness (no strand/blank) is unit-tested. If
   this ever needs reverting, `git show e7f25a98af` has the removed eased code.

2. **Snapshot golden regen — DONE for the in-scope goldens.**
   - `demo-hg19-gene-glyph` — **regenerated** (canvas2d + webgl, committed
     `4e00b688a5`). canvas2d diff was 2.14% (label shift + committed `>>`
     chevrons from `921648ba08`), verified in the diff-visual. The webgl golden
     was additionally stale from Jun 4 (34% — predated a demo track rename +
     label rendering); its gene bodies/UTR/chevrons match the canvas2d golden so
     it was stale content, not GPU variance. **Caveat:** webgl golden regen'd on
     *this* box — may want a final regen on canonical CI hardware if GPU
     antialiasing pushes it back over the 5% webgl threshold there.
   - `additional-multisample-vcf` — **verified, deliberately NOT regenerated.**
     Its 2.44% diff is scattered matrix-*cell* rendering changes + a legend-text
     position shift. The matrix-cell change is not attributable to this
     virtual-scroll migration (which only moves scroll/labels), so per
     "regenerate only if settled/intended" it's left for its owner (likely the
     variant-matrix subpixel-alpha work). Don't blanket-regen it with this
     migration.
   - Out-of-scope failures from the earlier full suite run (BigWig GC content/
     skew, BEDPE arcs, alignments linked-read/methylation, Hi-C ~1% near-flaky,
     wiggle-color timeout, sequence-display selector) remain their owners'.

   Regen recipe (if needed): `pnpm --filter @jbrowse/web build` then
   `DISPLAY=:0 node browser-tests/runner.ts --filter="<suite>" --test="<name>" -u`
   (add `--backend=webgl -u` for the webgl golden).

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
