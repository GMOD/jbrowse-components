---
name: jbrowse-web-test-cost
description: products/jbrowse-web is 589s of the jest suite's 1243s and the harness-level work is done, so what is left is the test files — 63s of it four suites sleeping on a 500ms debounce. Analysed 2026-08-30, nothing acted on; carries two calibration corrections that change what every other estimate here is worth.
---

# What is left in products/jbrowse-web's test cost

The harness half of this thread landed on 2026-08-30 (`4af22cd8d2`, `f418c08e80`,
`5ba5bad912`): whole suite 372s → 216s, jest startup 3.6s → 0.83s, agent
sessions off the flat one worker. The record is
[reference/TEST_INFRASTRUCTURE.md](../reference/TEST_INFRASTRUCTURE.md#where-a-warm-pnpm-test-spends-its-time)
and the scaling table's source is `measurements/jest-worker-scaling.json`.

What did not land is the test files themselves. `products/jbrowse-web` is 180
suites, **588.6s of the 1243s** a whole run sums to — 468.5s inside test bodies,
120.2s outside them, median per-suite overhead 0.55s.

## Retaking the numbers

```sh
JEST_MAX_WORKERS=4 npx jest --ci --silent --json --outputFile=/tmp/w4.json
```

`.testResults[]` carries `startTime`/`endTime` per suite and
`assertionResults[].duration` per test, so suite seconds minus the sum of its
test durations is import + environment + hooks. Every figure below came from
that file; none of them is in the tree.

## Two corrections to apply before believing any estimate, this doc's included

**A `volvoxConfigWithTracks` trim is worth ~0.30s per `createView`, not the
~1.1s** [the `createView()` section](../reference/TEST_INFRASTRUCTURE.md#what-a-createview-actually-costs)
implies. That doc's 1.5s → 0.4s is a cold isolated measurement; the in-run
number is the A/B in `f418c08e80`, where trimming `testFileReload` moved
`Reload.test.tsx` 12.86s → 10.61s over seven calls, and both timing JSONs agree
independently. Every trim figure below is at 0.30s. This divides that whole
lever by about 3.7 and is the main reason the total is modest.

**`getByLabelText` did not reproduce at the 4-17s that section quotes.** Timed
at the jsdom level across seven suites it is 0.2-0.5s a call, and `ByRole` with
a role that maps to a CSS selector is ~20ms. Unsettled — one measurement against
a documented one, on a box whose own docs say a single timing is noise. It
matters only as a *don't*: the whole `ByLabelText`/`ByRole` category across this
directory is ~4s either way, so the sweep is not worth running, and nobody
should edit that section until someone re-times `getByLabelText` deliberately.

## The findings, largest first

**1. Four synteny-follow suites sleep through 63s of their 72.3s.** Verified
against both the JSON and the source. `LinearSyntenyFollow.test.tsx` holds 17
`setTimeout`s — 13x1500ms plus 3000, 2500, 6000 and 4000 = 35.0s; its 15
sleeping tests sum to 36.7s while its other **20 tests sum to 2.4s**.
`LinearSyntenyOrientationFollow`, `LinearSyntenyMoveFollow` and
`LinearSyntenyOffscreenMateFollow` each carry a byte-identical `settle()` at
2000ms called 4-5 times, 28s more.

What they wait on is named in `settle()`'s own comment and is
`coarseDynamicBlocksAutorun` in
`plugins/linear-genome-view/src/LinearGenomeView/afterAttach.ts:302`,
`{ delay: 500 }` — so 1500ms is 3x it and 2000ms is 4x. A positive settle signal
(spy `setCoarseDynamicBlocks`, or the `namedAutorun` / `reactionDependencies`
machinery this subsystem already has) is worth **~46s** and is strictly stronger
than a sleep, because it pins that the pass ran at all, which a sleep never did.
Merely tightening the constants to 800-1000ms is ~23s and buys no assertion
strength.

**Leave the `setTimeout(6000)` and `setTimeout(4000)` alone** — a swapped-assembly
track and the resolve-after-toggle case almost certainly wait on more than one
cycle. Nobody has traced `installSyntenyFollow`'s exact pass to see whether an
RPC lands after the debounce, and everything above depends on it.

**2. Ten sibling families, ~50 files, worth ~24.6s** at the 0.55s median
overhead a removed file returns. The shape `Reload.test.tsx` already proved:
`AlignmentArcs`/`AlignmentLinked`/`AlignmentStack` differ only in a `displayMode`
argument; the six `Launch*View` files; the eight `*ViewInit`; the six
`ExportSvg*`; the nine `Alignments*`; the five teardown suites. Two riders: a
family whose members happened to be the first suite in a worker returns less
than 0.55s each, since that cost moves to whoever starts the worker next; and
merging six 3s suites into one 18s suite trades summed time against scheduling
flexibility and against `test-related` granularity.

**3. Twelve suites can take a trimmed config, 65 view creations, ~19.5s.**
Highest confidence: `BookmarkWidget` (11 calls; its only track reference is
`findByTestId('tracksContainer')`, the LGV container), `SessionMenu` and
`AssemblySelectorImportForm` (no occurrence of `track` at all), `StatsEstimation`,
`ExportSession`, `SVInspectorFiltering`. Partial: `BasicLinearGenomeView` minus
its selector and reorder tests, the two import-form suites minus their
"open tracklist file" test. Least sure, and the two worth ~5.7s: both
`TextSearching` suites, because `volvoxConfigWithTracks` filters `tracks` and
**per-track text-search indexes go with their tracks** — trim to the tracks the
searches land on and run them, since a search that resolves nothing fails loudly.

Name one cheap track rather than passing `[]`; the empty-tree render path is
exercised by nothing else.

**4. `ExportSvgMultiSampleVariant.test.tsx`, ~8s.** Four tests, two setups'
worth of work: both `matrix` tests run the same `openMultiSampleVariantDisplay`
→ `findDisplayPainted` → `exportSvg` and then assert on the same SVG string, and
the two `regular` tests do likewise. Merging each pair costs one masked
assertion per pair unless the blocks keep distinct messages.

**5. Three more fixed sleeps, ~4s.** `BigWigColor.test.tsx` sleeps 2000ms after
`setColor` before a canvas snapshot — 4.0s of its 6.4s — where a
`waitFor(() => expectCanvasMatch(...))` is the positive signal.
`AlignmentsSort.test.tsx` sleeps 1000ms between an `expectCanvasMatch` and a
zoom click with `findDisplayPainted` on both sides; **it carries no comment**,
which by this repo's convention means nobody knows what it is for — treat it as
load-bearing until someone does. `CopyConfigEntryPoints`' two 600ms sleeps sit
against a documented 400ms persist debounce and should stay.

## Do not touch

- **`LGVSynteny.test.tsx`** — the worked example in the `createView()` section;
  it picks a track out of a listbox by name, so a trimmed config makes the pick
  trivial. It names only three track ids, so a mechanical candidate list
  proposes it. That is the reason not to run one.
- **`SVInspector.test.tsx`'s "Open from track"** — same rule, found by reading:
  it selects a track out of the SV inspector's own dropdown, populated from the
  session's track list.
- **`CopyAndDelete.test.tsx`'s delete path** — asserts on what is *not* shown.
- **`BasicLinearGenomeView`'s "opens track selector" and the reorder test.**
- **All five `userEvent` sites** (`BookmarkWidget.test.tsx:62`, `:83`, `:134`,
  `:167`, `BasicLinearGenomeView.test.tsx:198`), each already commented. That
  category is fully harvested; there is no sixth site in the directory.
- **`VcfCluster`, `AlignmentGroupBy`, `ZoomRenderCensus`** and the test bodies of
  `ExportSvgMultiSampleVariant` — already trimmed, and their time is real
  clustering, painting and SVG generation.

## Total, and the two hours that would settle it

**~55s to ~105s of 588.6s**, the spread being almost entirely whether the sleeps
get a real signal or just smaller numbers. Two experiments collapse most of the
uncertainty:

1. **Trim `BookmarkWidget` alone** — 11 calls, the largest single trim — and
   run it interleaved. That confirms or kills the whole 19.5s trim line, since
   every figure in it rests on one A/B over one file.
2. **Trace `installSyntenyFollow`'s exact pass** for anything landing after the
   coarse-blocks debounce. It is 63s and the highest-value hour on this list.

## Closing this

The two corrections above are the part with a permanent home: whoever settles
`getByLabelText`, and whoever confirms or kills the 0.30s figure, edits
[the `createView()` section](../reference/TEST_INFRASTRUCTURE.md#what-a-createview-actually-costs)
and the section above it rather than this file. The findings go the usual way —
each one taken becomes a commit and needs nothing here, and any left over that
somebody still wants becomes an [idea](../ideas/README.md), one per file. Then
delete this.

