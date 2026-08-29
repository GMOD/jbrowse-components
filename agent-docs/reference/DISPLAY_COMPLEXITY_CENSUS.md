---
name: display-complexity-census
description: Where a display's complexity actually sits, measured — drawing is the healthiest layer, layout is bespoke and mostly correctly so, and the declaration (config slots, volatiles, getters, and the five surfaces hand-written against them) is the whole cost. Also records what a declaration would NOT buy: 60 declarable getters out of 321, and 0 eliminated. Every figure is a 2026-08-24 snapshot that had drifted by 2026-08-28 — re-measure, don't quote.
audience: internal
---

# Where a display's complexity sits

Taken 2026-08-24 to answer "is a declarative display simpler", and kept because
the *shape* of the answer outlived the proposal that asked it. The proposal
itself — a display handed to a factory as a spec — ran and was rejected, and
the factory it turned on is gone from the tree;
[ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)
holds that history and every branch-only measurement.

**Every count here is a 2026-08-24 snapshot and all of them had drifted by
2026-08-28** — the four model files gained 64-118 lines each, `render-core` went
7,648 → 8,314. The magnitudes are the argument; the digits are not evidence any
more. Re-measure before quoting, and prefer a figure you took yourself.

## Three things get called complexity, and they have opposite answers

| Axis | Measured | Verdict |
| --- | --- | --- |
| Drawing | 57 `.slang` in tree, `render-core` 7,648 lines, `GpuHal` 17 methods, `RenderingBackend` 2 | already the healthiest layer |
| Layout | five independent placement implementations; `sortLayout.ts` 1,096 and `layout.ts` 1,741 lines | bespoke, and mostly correctly so |
| Declaration and its consequences | 178 config slots, 52 volatiles, 288 getters in four model files (321 once `configSlotViews.ts` is counted) | the whole cost |

That ordering is the finding. Work aimed at the drawing layer is aimed at the
part already in the best shape — which is why the render-path proposals that
survived this census moved out as a *factoring* exercise rather than a
simplification one (landed;
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md)
is the record), and why the placement half was retired outright on a re-census.

## Where the declaration cost sits

| File | Lines | `#getter` | `#action` |
| --- | --- | --- | --- |
| `alignments/LinearAlignmentsDisplay/model.ts` | 3,896 | 115 | 66 |
| `maf/LinearMafDisplay/stateModel.ts` | 2,452 | 78 | 26 |
| `canvas/LinearBasicDisplay/baseModel.ts` | 1,947 | 47 | 23 |
| `variants/shared/MultiSampleVariantBaseModel.ts` | 1,697 | 48 | 19 |

Five surfaces are written by hand **against** those getters, once per display:
track menus (6,822 lines in plugins plus 5,153 of shared machinery), dialogs
(8,692 lines, 40 files), legends (4,058 lines, 27 files), hit tests (21 files,
3,335 lines in alignments alone), renderer classes (5,353 lines).

## What a declaration would not buy

The number that matters most is the one that is zero.

- **Not all 288/321 getters are reducible.** 144 of the 288 have a body three
  lines or fewer; only 47 read `getConf` / `readConfObject` / `resolveConf` at
  all. The declarable target measured **60, not the ~90 first counted**.
- **The count eliminated is 0.** Deleting a display's own getters moves the
  break to its public surface — menus, dialogs, renderers, SVG export and
  third-party plugins all read them directly today. This was never a
  getter-reduction play, and anything proposing it as one has not read this.
- **A flat field table cannot hold what a slot MEANS.** Alignments' `colorBy` is
  a six-variant union with a nested six-field `modifications` object. ADR-091
  measured the declaration half and found the table standardizes a setting's
  plumbing — where the value lives, what changing it invalidates, how it must be
  read — and not its meaning.

## What this census is cited for elsewhere

[SESSION_SPEC_FORMAT.md](SESSION_SPEC_FORMAT.md) compares this codebase against
Gosling and GenomeSpy and leans on the layout figures above. Two corrections
belong with it rather than here: **a mark count needs its denominator stated**,
or two correct censuses disagree — which is what happened between these two
docs — and the claim that GenomeSpy "has no pileup" is **wrong**; it has one as
a per-view transform. That doc re-took its own counts on 2026-08-28 and owns
both corrections.
