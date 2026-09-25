---
name: deferred-architecture-review
description: What the 2026-07 architecture-review fix pass left for a decision — DisplayChrome height parity, `dataCurrent` as a required member, the chrome owning the container height.
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
