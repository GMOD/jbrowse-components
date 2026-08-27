---
name: per-base-subpixel-bin
description: The two per-base alignments colour modes emitted one JS object per aligned base of every read in the worker, unbounded by the viewport — 30.5M entries and 2.0 GB on a 1 Mb pacbio pileup, and an OOM at short-read depth. What the sub-pixel bin that bounds it does, what it measures at, and the compositing mechanism that made it visible in `perBaseLetter` and invisible in `perBaseQuality`. Read before touching `subPixelBinBp`, `forEachAlignedBaseInRegion`, or either per-base extract.
audience: internal
---

# The per-base wall, and the sub-pixel bin that bounds it

## The wall

`colorBy.type` of `perBaseQuality` or `perBaseLetter` is the only thing the
alignments pipeline draws that is a **wall**: one emitted entry per *aligned
base of every read*, where every other pass emits one per *event* — a mismatch,
an indel, a modification call. `extractPerBaseQuality` and
`extractPerBaseLetter` pushed `{readIndex, position, score|base}` objects into a
plain array, and `buildAlignmentDetailArrays` flattened them into typed arrays
only afterwards, so the whole wall existed as JS objects in the worker before a
single byte was packed.

Nine bytes of payload per entry, carried by an object of a few dozen, plus the
growing array's backing store and its doubling copies. Nothing bounded the count
by the viewport: it was `region span x depth`, and the region span is the
visible span widened by half a screen each side (`planRegionFetch`) — or
anything at all once **force-load** is approved, which exempts the byte gate
outright. At the default `fetchSizeLimit` of 5 MB on short-read data that is
order 10^7 entries; force-loading a chromosome has no ceiling.

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
process before a byte is packed, which is the crash this exists to prevent.
Entry counts and heap repeat exactly; the ms column moves with machine load, and
the same run under load 14 read 7,332ms on the top row.

## What the bin is

`subPixelBinBp(bpPerPx)` — `packages/display-kit/src/subPixelBinBp.ts`. The rule
MAF's GPU encoder already used: a power of two, `<= bpPerPx / 2`, and `1` below
4 bp/px. MAF's `encodeBinBp` calls it rather than spelling it, so the two
displays cannot drift on `MIN_BINNED_BP_PER_PX`.

- `forEachAlignedBaseInRegion` takes a `binBp` stride. Windows anchor to
  **absolute genomic coordinate**, not to the op or the read — anchored per read,
  each row samples different columns and the wall breaks into per-row stripes
  offset by each read's start.
- The display resolves `perBaseBinBp` off the **debounced** `coarseBpPerPx`, and
  returns `1` in every scheme that is not `perBase` in the `COLOR_SCHEMES`
  registry.
- It rides to the worker as a **call-site RPC argument**, the way `byteLimit`
  does, not as an `rpcProps` field — a zoom-swinging value in the payload is a
  `SettingsInvalidate` that drops every fetched region
  ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) §"How the verdict is built", and
  "Neither worker budget may be an RPC cache key"). `regionFetchKey` carries the
  per-region half, and `dataSuperseded` keeps an SVG export from sampling data
  the settled zoom has already moved past.

Bounded by the viewport now: `4-8 x canvasWidthPx x depth`, since the fetch span
is twice the viewport and `binBp` is within a factor of two of `bpPerPx / 2`.

**Do not reach for live `bpPerPx` in place of the debounce.** The cost is on the
MOVING viewport, not the parked one that the obvious argument reaches for:
`FetchVisibleRegions` throttles at 600ms rather than settling, so a live key
hands each throttled run the bin of a zoom the gesture is only passing through,
and each such run refetches the one pipeline whose extract is the OOM this bin
exists to bound. `livePerBaseBinBp`'s JSDoc carries the full argument;
`dataSuperseded` is the reader that wants the live bin, and it is not a refetch
trigger.

## The appearance claim was false, and lettering is where it shows

The commit that landed the bin said "nothing visible changes", reasoning from
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

> **"Both backends blend" is Canvas2D's mechanism, not the GPU's.** Measured
> 2026-08-27 across three zooms, no before-arm: Canvas2D holds 2,002–10,041
> distinct colours and 2–23% of its inked pixels on a pure base colour, while
> webgl holds 160–269 and stays 64–75% pure. `pileupCellX` snaps each cell to a
> whole pixel column and the winner covers it outright, so the GPU largely
> overwrites where Canvas2D averages; its residue is edge antialiasing, worst at
> 0.8 bp/px where a 1.27px cell lands mid-column rather than at the widest zoom
> where the most cells compete.
>
> The paragraph above still describes what the bin changed — the arms it rests on
> were captured on one backend and are untouched by this. What it does not
> support is a claim about the two backends together, and pointing the gate at
> this mode found them disagreeing by 16.39%:
> [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) §"The per-base wall".

<!-- BEGIN GENERATED MEASUREMENT per-base-cell-colour-purity -->

| bp/px | backend  | distinct colours | inked px on a pure base colour |
| ----: | -------- | ---------------: | -----------------------------: |
|   0.8 | canvas2d |            2,002 |                          22.60 |
|   0.8 | webgl    |              160 |                          63.60 |
|   3.2 | canvas2d |            5,965 |                           2.20 |
|   3.2 | webgl    |              193 |                          64.80 |
|  37.9 | canvas2d |       **10,041** |                       **9.20** |
|  37.9 | webgl    |          **269** |                      **74.90** |

<!-- END GENERATED MEASUREMENT per-base-cell-colour-purity -->

That falsifies the sentence the design rested on — that the skipped bases had
already lost the sub-pixel race, so the survivor was arbitrary either way. True
under last-writer-wins, false under blending, and both backends blend.
`subPixelBinBp`'s JSDoc says so.

**A second thing the numbers say.** `binBp` sits in `(bpPerPx/4, bpPerPx/2]`, so
the surviving overdraw is a CONSTANT 2-4x at every zoom, by construction. The
bin caps the compositing depth; it never removes it. So the wall still reads as
sub-pixel after the change, just less so — which is what a reader notices first,
and what none of the arithmetic above predicts.

## Scope: what the bin deliberately does not touch

Every **sparse** mark: mismatches, indels, SNP columns, modifications, arcs.
They are already handled by `featureFrequencyThreshold`, the frequency lerp and
`extendToMinWidthX`, and
[ideas/maf-subpixel-cells.md](../ideas/maf-subpixel-cells.md) records alignments'
own argument for why a point event must stay opaque when a screen holds more
bases than pixels. Fetch-side object churn elsewhere — Manhattan's per-line
`Feature` objects, `flatbushItems` / `subfeatureInfos` — is a different thread,
and
[ideas/stop-rewriting-the-workers-arrays-to-lay-out-features.md](../ideas/stop-rewriting-the-workers-arrays-to-lay-out-features.md)
holds its 365ms clone measurement.

## What is still open

- **What a per-base wall should look like at wide zoom**, and the one octave of
  headroom the 1bp cell leaves — four candidates and three fixes, none built:
  [ideas/per-base-wall-at-wide-zoom.md](../ideas/per-base-wall-at-wide-zoom.md).
- ~~**No cross-backend test covers a per-base mode at any zoom.**~~ Two scenes do
  since 2026-08-27, and **both failed on their first run** — against a
  disagreement that predates the bin, not one it caused. The gate finding, its
  mechanism and the numbers are in
  [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md) §"The per-base wall". What it
  means for this doc is below.
- **Typed columns instead of entry objects**, which the closest in-tree
  measurement says would be a loss —
  [ideas/bench-typed-columns-against-the-per-base-extract.md](../ideas/bench-typed-columns-against-the-per-base-extract.md).
- **The new refetch traffic** the octave-crossing key introduces, unwatched on a
  real BAM —
  [todo/watch-the-per-base-refetch-on-a-real-bam.md](../todo/watch-the-per-base-refetch-on-a-real-bam.md).
