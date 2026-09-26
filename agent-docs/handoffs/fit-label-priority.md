---
name: fit-label-priority
description: Fit decimation now ranks gene names first (4a1b716c94) and thins a same-start pile to its leader (c517a1490f). Open are a reshoot of the six volvox views, gene names under the label density gate, the stage-2 fallback that drops every other name, and whether the gene rule's `transcript` match is too loose. Read before touching `labelOverhangRoomPx`, `solveLabelRoomFactors` or the auto label density gate.
---

The `decimated` rung now solves gene names' room factor first, then the
other names' beside them (`solveLabelRoomFactors`, `fitLadder.ts`). In a pile
of features sharing one start, only the leader (a gene, else the longest)
reads the gap past the pile (`labelOverhangRoomPx`, `labelReservation.ts`).
**Delete this file once the calls below are answered and built.**

## 1. Reshoot the six volvox views

Nobody has looked at the pile rule. The before/after artifact for the gene
tier (ctgA:1-25000, ctgA:1050-9000 and a third locus, each at 100 and 200px)
predates it, and agents on the second account can't read it. The pile rule
changes more than the gene tier did. Any EST or read pile sharing a start now
keeps one name, where before it dropped them all together.

Recommended: reshoot those six views on main and compare with the artifact
before building anything below.

## 2. Gene names under the auto label density gate

Above 0.2 features per px, `showLabels` hides every name on the track, and the
count includes every feature (`baseModel.ts:395-406, 503-508`). In a gene track
mixed with evidence, the evidence pushes the count over the threshold, so the
gene tier never runs at the zooms where names crowd.

Options:
- **(a) Recommended: gate each tier on its own density.** Non-gene names hide
  at the threshold. Gene names hide only when gene features alone pass it.
- (b) Gate on gene density whenever any gene is on screen.
- (c) Leave the density gate as one track-wide switch.

## 3. The stage-2 fallback drops every other name

When the other names can't fit even at the factor cap of 8,
`solveLabelRoomFactors` returns `labelRoomFactor: Infinity`
(`fitLadder.ts:106-110`), which drops them all, including ones that cost no
height. Reviewer's case: G 1000-9000 (gene), est 1000-5000, O1 6000-8000,
O2 30000-31000, at 10 bp/px and height 70. Main shows O1 and O2; now only G
shows, though G plus O2 packs to 65px. O1's room is 2400px, so no finite
factor drops it, and O2 goes with it.

The root cause is that room measures horizontal gap, while what a name costs
is a line of height. Options:
- (a) Recommended: park until a real track shows it. Probes only, no capture.
- (b) Replace the room measure with each name's height cost. Large; it
  reopens the July and September pile trade-offs (`178f7b8ed4`,
  `6ead7481d1`).

## 4. Is the gene rule's `transcript` match too loose?

`geneTypeTest` reuses `isGeneLikeType` (`featureTypes.ts:12`), whose
unanchored `transcript` match marks `transcriptional_cis_regulatory_region`
and `transcription_start_site` as genes. Their names would outrank real genes'.
UCSC BED12/bigPsl rows with blocks and thick columns become
`transcript`/`mRNA` (`generateUcscTranscript.ts:30-45`), so EST alignments
count as genes too. "Show only genes" shares the rule, so any fix changes that
filter as well. No test data carries either regulatory type; whether current
RefSeq GFFs do is unverified.

The match is unanchored on purpose, for `pseudogenic_transcript` and
`transcript_region` (`featureTypes.ts:10-11`).

Options:
- (a) Recommended: tighten it to `transcript(_region)?$`, which keeps both
  and drops the `transcription*` types, after checking a RefSeq GFF for them.
- (b) Leave it.

## Not a call

- A display-level test in `fitToDisplayHeight.test.ts` with gene-marked items
  would cover the `namedLabelTiers` / `fitMeasureFeatureIds` wiring, which
  only `layout.test.ts` tests one function at a time.
- The reviewer measured the gene tier at 20 packs instead of 10 in the worst
  case: 85ms against 45ms with 2,000 synthetic features, in node. It applies
  to mixed tracks only, and nothing has profiled it in a browser.
- Fixed-height mode and row order are untouched.
