---
name: deferred-architecture-review
description: What the 2026-07 architecture-review fix pass left for a decision — DisplayChrome height parity, `dataCurrent` as a required member, the chrome owning the container height — and the bring-your-own chrome pass's one loose end.
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
  getter" cleanly, and [ADR-041](../../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)
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
[reference/EAGER_BUNDLE.md](../../reference/EAGER_BUNDLE.md), "Theme-free
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
