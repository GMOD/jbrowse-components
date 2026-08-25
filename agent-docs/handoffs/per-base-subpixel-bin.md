---
name: per-base-subpixel-bin
description: The two per-base alignments colour modes built one JS object per aligned base of every read in the worker, unbounded by the viewport; the sub-pixel bin that bounds it has landed, and is measured at 30.5M entries / 2.0 GB down to 59.6k / 6.7 MB on a 1 Mb pacbio pileup. What is still open is the one-octave headroom the 1bp cell leaves (a fast zoom-in stripes the wall until the refetch lands), and whether the per-base extract should write typed columns instead of objects — which the closest in-tree measurement says would be a LOSS.
---

# The per-base wall's worker heap peak

## What the crash was

`colorBy.type` of `perBaseQuality` or `perBaseLetter` is the only thing this
pipeline draws that is a **wall**: one emitted entry per *aligned base of every
read*, where every other pass emits one per *event* (a mismatch, an indel, a
modification call). `extractPerBaseQuality` / `extractPerBaseLetter` pushed those
entries as `{readIndex, position, score|base}` objects into a plain array, and
`buildAlignmentDetailArrays` only flattened them into typed arrays afterwards —
so the whole wall existed as JS objects in the worker before a single byte was
packed.

Nine bytes of payload per entry, carried by an object of a few dozen, plus the
growing array's backing store and its doubling copies. Nothing bounded the count
by the viewport: it was `region span x depth`, and the region span is the
visible span widened by half a screen each side (`planRegionFetch`), or anything
at all once **force-load** is approved, which exempts the byte gate outright. At
the default `fetchSizeLimit` of 5 MB on short-read data that is order 10^7
entries; force-loading a chromosome has no ceiling.

**Measured** — `plugins/alignments/benches/perBaseWall.probe.ts`, over the
in-tree pacbio HG002 fixture: 2,296 real CCS reads across 1.03 Mb, about 33x, so
a 1000 px canvas showing that span sits at the bottom row's zoom.

<!-- BEGIN GENERATED MEASUREMENT per-base-wall-bin -->

| bp/px | binBp | entries emitted | extract | retained heap (MB) |
| ----- | ----: | --------------: | ------: | -----------------: |
| 2     |     1 |      30,565,003 |  2026ms |            2033.50 |
| 4     |     2 |      15,282,758 |  1658ms |            1269.40 |
| 8     |     4 |       7,641,315 |   489ms |             680.40 |
| 32    |    16 |       1,910,260 |   106ms |             149.10 |
| 128   |    64 |         477,700 |    21ms |              46.00 |
| 512   |   256 |         119,303 |    12ms |              12.60 |
| 1,024 |   512 |      **59,624** |     8ms |           **6.70** |

<!-- END GENERATED MEASUREMENT per-base-wall-bin -->

Read the top row against the bottom: that is the same picture, sampled once per
base and once per pixel. Repeat the fixture to `--depth=8`, the ~260x a deep
short-read pileup reaches, and the top row does not exist — `binBp` 1 OOMs the
process before a byte is packed, which is the crash. Entry counts and heap
repeat exactly; the ms column moves with machine load, and the same run under
load 14 read 7,332ms on the top row.

## What landed

`subPixelBinBp(bpPerPx)` — `packages/display-kit/src/subPixelBinBp.ts`. The rule
MAF's GPU encoder already used: a power of two, `<= bpPerPx / 2`, and `1` below
4 bp/px. MAF's `encodeBinBp` now calls it instead of spelling it, so the two
displays cannot drift on `MIN_BINNED_BP_PER_PX`.

- `forEachAlignedBaseInRegion` takes a `binBp` stride. Windows are anchored to
  **absolute genomic coordinate**, not to the op or the read — anchored per read,
  each row samples different columns and the wall breaks into per-row stripes
  offset by each read's start.
- The display resolves `perBaseBinBp` off the **debounced** `coarseBpPerPx`, and
  returns `1` in every scheme that is not `perBase` in the `COLOR_SCHEMES`
  registry.
- It rides to the worker as a **call-site RPC argument**, the way `byteLimit`
  does, not as an `rpcProps` field — a zoom-swinging value in the payload is a
  `SettingsInvalidate` that drops every fetched region
  ("Neither worker budget may be an RPC cache key",
  REGION_TOO_LARGE.md §"How the verdict is built").
  `regionFetchKey` carries the per-region half, and `dataSuperseded` keeps an
  SVG export from sampling data the settled zoom has already moved past.

Bounded by the viewport now: `4-8 x canvasWidthPx x depth`, since the fetch span
is twice the viewport and `binBp` is within a factor of two of `bpPerPx / 2`.

## The appearance claim was false, and lettering is where it shows

The commit that landed this said "nothing visible changes", reasoning from
`binBp <= bpPerPx / 2` against a 1 CSS px cell floor. Coverage does survive that
arithmetic. The blend does not, and nobody had looked.

`products/jbrowse-web/browser-tests/probe-per-base-bin.ts` captures both arms
from two builds — the before arm is `perBaseBinBp` forced to `1` — and diffs
them.

<!-- BEGIN GENERATED MEASUREMENT per-base-bin-appearance -->

| scene                                 | binBp | px differing | ink delta | colour TV | saturated px before |     after |
| ------------------------------------- | ----: | -----------: | --------: | --------: | ------------------: | --------: |
| lettering, 37.9 bp/px                 |    16 |        28.30 |     -1.40 |     0.737 |           **31.90** | **57.50** |
| lettering, 6.3 bp/px                  |     2 |        23.10 |     -0.50 |     0.537 |               40.20 |     50.30 |
| quality, 37.9 bp/px                   |    16 |        27.60 |     -1.70 |     0.368 |               88.00 |     82.80 |
| quality, 6.3 bp/px                    |     2 |        20.40 |     -0.50 |     0.105 |               85.00 |     83.90 |
| colour-by normal, 6.3 bp/px (control) |     1 |         0.00 |      0.00 |      0.00 |                2.50 |      2.50 |
| quality, 0.8 bp/px (control)          |     1 |         0.00 |      0.00 |      0.00 |               80.30 |     80.30 |

<!-- END GENERATED MEASUREMENT per-base-bin-appearance -->

Both controls are byte-identical, so the capture is stable and the rest is the
bin. **`perBaseQuality` is visually equivalent** at every zoom captured, mismatch
columns included. **`perBaseLetter` is not**: the wall goes from muddy olive to
vivid stripes and the saturated share nearly doubles.

**The mechanism, which is the part that generalizes.** Both backends floor a
cell to 1 CSS px while samples sit `binBp` apart, so the number of cells
compositing into one pixel is `bpPerPx / binBp` — about 38 before the bin at
37.9 bp/px and about 2.4 after. A pixel under N blended cells reports roughly
their mean. `perBaseQuality`'s colours are a narrow ramp, so a single draw is
close to the mean and the change is invisible; base letters are four widely
separated hues, so 38 of them average to mud and 2 of them do not.

That falsifies the sentence the design rested on — that the skipped bases had
already lost the sub-pixel race, so the survivor was arbitrary either way. True
under last-writer-wins, false under blending, and both backends blend.
`subPixelBinBp`'s JSDoc now says so.

**A second thing the numbers say.** `binBp` sits in `(bpPerPx/4, bpPerPx/2]`, so
the surviving overdraw is a CONSTANT 2-4x at every zoom, by construction. The
bin caps the compositing depth; it never removes it. So the wall still reads as
sub-pixel after the change, just less so — which is what a reader notices first,
and what none of the arithmetic above predicts.

## Open: what a per-base wall should look like at wide zoom

Four candidates. Nothing here is built, and this is the live question.

- **Ship as is, document the trade.** Cheapest. The cost is that wide-zoom
  lettering over-states confidence: a vivid base colour where the honest answer
  is "mixed", which `ideas/maf-subpixel-cells.md` argues against for tiling
  cells in as many words.
- **Bin `perBaseQuality` only.** One predicate in `isPerBaseScheme`. The bin is
  provably invisible there, and quality is the more used of the two. But
  lettering then has no bound at all, and force-load is what OOMs.
- **Stop painting lettering above a zoom threshold**, falling back to the normal
  read body. Bounds the heap absolutely rather than proportionally, and retires
  the appearance question instead of answering it. The cost is a mode that
  visibly switches off as the user zooms out.
- **Per-window base histogram, blended in a dedicated shader, cell spanning the
  bin.** Four unorm8 ACGT lanes per (read, window) from k sub-samples, +3 bytes
  on ~60k entries. Keeps the base-weighted blend the before arm had — but
  deterministically, and identically on both backends, where the before arm's
  was an emergent compositing accident no test ever pinned. The span also
  retires the headroom octave below. Two things make it cheaper than it sounds:
  the letter pass ALREADY neutralizes both fades of the shader it borrows
  (`perBaseLetter/packGpu.ts` writes `frequency=1` and the `QUAL_UNAVAILABLE`
  sentinel), so a dedicated shader removes code rather than adding coupling; and
  it touches neither `mismatch.slang` nor `packedColorQuad.slang`, so the five
  shared packers stay out of it.

  **Blend shader-side, not at pack time.** `syncRegion` re-uploads instance
  buffers only on a data identity change, so an ABGR baked into the instance
  goes stale on a theme change and on the show-modifications grey-mute, both of
  which work today by rewriting the UBO. GPU-only, and silent.

  **k matters and is unmeasured.** Sub-sampling k per window keeps the pass
  `O(viewport)`; a full visit does not — benched at ~350-500ms on the pacbio
  fixture *regardless of `binBp`*, which resurrects exactly the
  viewport-independent work this change killed. k=4 benched at ~1.5-2x the
  shipped extract with entry counts unchanged. Whether k=4 *looks* right is not
  known, and needs a third arm through the probe.

**No cross-backend test covers a per-base mode at any zoom** — `grep perBase`
over `products/jbrowse-web/browser-tests/` finds only the probe. Whatever gets
decided, that gap is why this shipped believing a claim nothing could have
failed.

## Open: the 1bp cell leaves exactly one octave of headroom

Both backends floor a per-base cell to 1 CSS px (`pileupCellX` extends to
`bp + 1u`; `pileupCellWidth` is `max(1, 1/bpPerPx)`), and samples sit
`binBp` apart. So the wall is unbroken iff `binBp <= bpPerPx`, and `binBp` was
chosen as `<= coarseBpPerPx / 2` — **one zoom step of headroom, and no more**.

A single zoom step in is therefore exactly safe. A *multi-octave* zoom-in before
the debounce settles and the refetch lands draws the wall as stripes, for the
debounce plus one RPC. That is a new timing-dependent appearance, which is the
kind of thing `ideas/maf-subpixel-cells.md` argues is a defect on its own terms.

MAF does not have this because it widens the sampled cell to the bin
(`runEnd = gpos + binBp`, `mafInstanceBuffer.ts`). Alignments cannot, cheaply:
the 1bp span is baked into `pileupCellX`, shared by five packers across
`mismatch.slang` and `packedColorQuad.slang`. Giving the cell an explicit span
is a real change to shared shaders — and also the enabling step for anything
that wants run-merged cells.

Three ways out, none taken:

- **Per-instance span** in both cell shaders, five packers writing `1`. Correct,
  removes the artifact entirely, biggest diff.
- **`binBp <= bpPerPx / 4`.** One line, buys a second octave, halves the win.
- **Accept it.** Self-correcting, bounded by debounce + RPC.

Do not reach for the debounce as the fix by switching to live `bpPerPx`: the
quantization means the key would still only flip per octave, so it looks free,
but a viewport parked on an octave boundary would then thrash a full region
refetch on every jitter.

## Open: typed columns vs objects, and the measurement that says don't

The bin bounds the count; it does not change the shape. At base-level zoom
(`binBp === 1`) a deep pileup still builds one object per aligned base.

The obvious next step is for the extract to write growable typed columns
directly, deleting `buildArrays.ts`'s copy pass. **The closest measurement in
the tree says that would be slower.** `plugins/alignments/benches/modExtract.bench.ts`
measured exactly this substitution for `ModificationEntry` and scored the
columnar arm at **3.379x against the shipped arm's 4.008x** — a loss — because
the entry objects are short-lived and die in the nursery, while growable columns
pay doubling copies and an intern lookup per push.

Reasons it may not transfer, all untested:

- No string interning here. A per-base entry is three numbers; the mod bench's
  columns paid a `type` intern per push.
- Three fields, not eight.
- **Scale and lifetime.** 148,045 mod marks die young; millions of per-base
  entries accumulate across every feature in the group and get promoted, which
  is the heap peak in the first place. "Dies in the nursery" is the mod bench's
  whole mechanism and it is the part that most plausibly breaks.

So this wants a bench arm before a rewrite, not after. `modExtract.bench.ts` is
the harness to copy — including its rule against a shared driver, which has
scored a byte-identical control at 1.14x in this repo.

## Open, smaller

Per-base modes now refetch on a zoom-in that crosses an octave, where before
they never refetched on zoom. Defensible — the held data is genuinely too coarse
to draw at the new zoom — but it is new fetch traffic in a mode that had none,
and nobody has watched it on a real BAM.

## Deliberately untouched

Every **sparse** mark: mismatches, indels, SNP columns, modifications, arcs.
They are already handled by `featureFrequencyThreshold`, the frequency lerp and
`extendToMinWidthX`, and `ideas/maf-subpixel-cells.md` records alignments' own
argument for why a point event must stay opaque when a screen holds more bases
than pixels. Fetch-side object churn elsewhere — Manhattan's per-line `Feature`
objects, `flatbushItems`/`subfeatureInfos` — is a different thread; see
`todo/stop-rewriting-the-workers-arrays-to-lay-out-features.md`, which holds the
365ms clone measurement.
