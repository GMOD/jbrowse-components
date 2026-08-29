---
name: a-display-declares-itself
description: A multi-level simplification target whose Levels 0, 0.5, 1, 2, 3 and 5 all ran or were retired; only Level 4 (the band stack) is still open. The factory this plan targeted, `defineDisplay`, was removed from the tree with ADR-091, which also rejects ADR-089 and ADR-090 and holds the full history and every branch-only measurement — read it first. What survives here: the census (four model files, 60 declarable settings-and-UI getters out of 321, not the ~90 first counted, 0 eliminated by the declaration) and Level 4's band-stack contract. The render-path half of the position moved to a-shape-composes-a-scale, which is the live plan.
---

# A display declares itself

**Status: five of six levels are closed. Read [ADR-091](../architecture-decision-records/adr-091-a-displays-settings-are-a-declaration.md)
first** — it holds the full history (Level 0's Manhattan port, why it fit only
through six override hooks, the branch-only measurements, what was salvaged)
and is the record of what this doc used to argue at length. This file now
keeps only what still has a live consumer: the census below, and Level 4.

- **Level 0** (re-gauge the factory on Manhattan) ran 2026-08-24. It fit, then
  came back off: every field the port added was an override hook, the
  settings table it left behind eliminated 0 getters, and RFC-001 §2's "the
  complex case needs the full shape regardless" was confirmed on its own
  example rather than falsified. ADR-091 is the record.
- **Level 0.5** (reconcile the two Mark systems) fell with the factory —
  `display-kit/src/marks.ts` was removed by ADR-091. What remains of the
  question — whether alignments' mark can take its row band as an argument —
  is owned by
  [one-mark-declaration-per-feature](one-mark-declaration-per-feature.md).
- **Level 1** (the channel and the scale) survived only in its smaller form —
  declaration metadata on existing models — which the branch built and
  ADR-091 rejected: the table holds a slot but cannot hold what the slot
  means (alignments' `colorBy` union has a nested six-field sub-object no
  flat field list expresses). The render-path half of the position — take the
  grammar at the shader layer, stop it at layout — moved to
  [a-shape-composes-a-scale](a-shape-composes-a-scale.md), which is the live
  plan.
- **Level 2** (name the placement) was RETIRED 2026-08-28 on a re-census:
  packing already merged the narrow way
  (`packages/core/src/util/layouts/placeRect.ts`), and drop-versus-sentinel
  turned out to be five consumer-correct conventions rather than a two-sided
  conflict to settle. The one real gap the census found — wiggle relying on
  "a reorder re-places, never refetches" with no test — is now covered
  (`MultiLinearWiggleDisplay/fetchAutorun.test.ts`). The per-consumer evidence
  behind "five consumer-correct conventions" — each display's sentinel choice
  cited against the tree, plus the two opposing named tests that pinned the
  original two sides — is in `f6b798b34a`, not restated here.
- **Level 3** (hit derives from the mark) depended on 0.5 and Level 1's
  per-instance channels, both gone.
- **Level 4** (the band stack) is the only level that stands, kept in full
  below.
- **Level 5** (one spec, three front-ends) depended on Level 1 landing, which
  it did not.

## What the census says

Three things get called complexity here, and they have opposite answers.

| Axis | Measured | Verdict |
| --- | --- | --- |
| Drawing | 57 `.slang` in tree, `render-core` 7,648 lines, `GpuHal` 17 methods, `RenderingBackend` 2 | already the healthiest layer |
| Layout | five independent placement implementations; `sortLayout.ts` 1,096 and `layout.ts` 1,741 lines | bespoke, and mostly correctly so |
| Declaration and its consequences | 178 config slots, 52 volatiles, 288 getters in four model files (321 once `configSlotViews.ts` is counted) | the whole cost |

Four model files hold the declaration cost:

| File | Lines | `#getter` | `#action` |
| --- | --- | --- | --- |
| `alignments/LinearAlignmentsDisplay/model.ts` | 3,896 | 115 | 66 |
| `maf/LinearMafDisplay/stateModel.ts` | 2,452 | 78 | 26 |
| `canvas/LinearBasicDisplay/baseModel.ts` | 1,947 | 47 | 23 |
| `variants/shared/MultiSampleVariantBaseModel.ts` | 1,697 | 48 | 19 |

And five surfaces are written by hand **against** those getters, once per
display: track menus (6,822 lines in plugins plus 5,153 of shared machinery),
dialogs (8,692 lines, 40 files), legends (4,058 lines, 27 files), hit tests
(21 files, 3,335 lines in alignments alone), renderer classes (5,353 lines).

**Not all 288/321 are reducible.** 144 of the 288 have a body three lines or
fewer; only 47 read `getConf`/`readConfObject`/`resolveConf` at all. The
target the plan measured is **60 declarable getters, not ~90**, and the count
the declaration *eliminates* is **0** — deleting a display's own getters would
move the break to its public surface (menus, dialogs, renderers, SVG export,
third-party plugins all read it directly today), which is why this was never
a getter-reduction play.

**Every count above is a 2026-08-24 snapshot and had already drifted by
2026-08-28** (the four model files gained 64-118 lines each; `render-core`
went 7,648 → 8,314). Re-measure before quoting any of it.

---

## Level 4 — The band stack

**Today.** Every large display is already a stack of bands, and none of them
says so. Alignments = coverage + pileup + arcs (`sectionLayout.ts`,
`belowCoverageBandsGeometry`, `computeStackedSections`). MAF = coverage +
conservation + rows. Multi-sample variant = variant lane + genotype matrix.
This is the MAF↔alignments kinship exactly: **one shared band and one
unshared one.** The coverage half is already packaged (`render-core/coverageBand.ts` +
`packages/alignments-core`, since `f2effb9167`); the rows half was Level 2,
which stands on its own contract (see above) without depending on one shared
implementation.

**The move — and it is narrower than it looks.**
[feature-band-consumers](../mechanisms/feature-band-consumers.md) already
declined generalizing the band allocators, correctly: `computeBandStack` is
five lines, sticky coverage and scrolling sections differ where they should.
**Do not overturn that.** What that doc has instead is seven rules, each
independently rediscovered by at least two plugins, and its own summary of
the cost: "~400 lines of executable glue and ~500 lines of prose re-deriving
the seven rules."

The move is to make **the contract** a type where the allocator stays a
function. A `Band` declares `reserve` / `paint` / `pick` / `active` off one
member, so "the reserver and the painter read one function" and "off spends
0 px" are build failures rather than prose.

**Gauge.** A second band consumer costs the 400 lines of glue and none of the
500 lines of prose.

**Note what that gauge deletes: prose, not code.** The ~400 lines of glue stay
by construction — the doc's own position is that the allocators should not be
generalized. So this is the highest-risk level with the smallest measured
code win, which is the inverse of every other level here. That is not an
argument against it (re-derivation is a real cost, and a build failure beats a
rule readers must remember), but it should be taken last rather than on
enthusiasm.

**Risk.** Highest of the five, and the one most likely to become a framework.
The kill condition is explicit: if the type cannot be written without a
registry, stop — a registry serving one display is
[ADR-050](../architecture-decision-records/adr-050-track-containers-are-not-view-types.md)'s
declined `trackContainer` again.

## What this must not become

Each of these has been declined already, on grounds that still hold:

- **A render graph, indirect draws, GPU-driven culling.** `GPU_RENDERING.md`
  §"What this architecture deliberately does not have", one specific reason
  each.
- **A transpiled draw stage.**
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  stands.
- **A band registry**, and **generalized band allocators**. See Level 4 above.
- **A mixin composed into `BaseDisplay`.**
  [ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md).
- **A glyph extension point inside `LinearBasicDisplay`.**
  [ADR-036](../architecture-decision-records/adr-036-delete-stranded-pluggable-glyph-registry.md).
- **Erasing the intentional backend divergences.** `WIGGLE_FUDGE_FACTOR`, the
  variant-matrix `f2`, synteny's stroke-vs-fill swap — each a property of the
  shape, which is what makes a shape library the right home for them.
