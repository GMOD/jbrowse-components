---
status: Accepted
summary: "The multi-sample variant display draws the VCF's structural variants above its genotype rows, colored by SV type and keyed, each lettered ID and description on one line, as `records: { show, growMaxHeight, labels }`, stacked by plugin-features's own pipeline: the cell payload rebuilt as features, packed, fit by LinearBasicDisplay's fit ladder (hosted, not copied), painted by `paintFeatureBand` and picked by its hit test, through the new `@jbrowse/plugin-features/band` entry. The band grows to its stack at full feature size up to `growMaxHeight` (170) and takes that height from the rows; past the cap the ladder fits the stack in. Off by default. Slice one of merging `LinearVariantDisplay` and `LinearMultiSampleVariantDisplay` into one display with `records` and `genotypes` bands. Amends ADR-250, whose first rejected alternative this takes. Amended: with no genotype rows (no samples, or `genotypes.show` off) the band is the whole display, every record the filter admits, sized by `heightMode`, labelled and fit by the records on screen"
---

# ADR-254: The multi-sample variant display draws a stacking records band

## Status

Accepted (2026-10-30), Colin: the two variant displays converge into one with
a records band and a genotypes band. This is slice one, the records band on
the existing matrix display. Amends ADR-250, which removed the one-row lane and
rejected un-flattening it; Colin's convergence call is what takes that
alternative now.

## Context

- ADR-250 removed the variant lane because it was one flattened row: a nested
  SV could not stack under the one holding it.
- Its first rejected alternative was to drop `flattenRows` and size the band
  to its packed rows. The objection was height: the band's pixels come from the
  genotype rows. Convergence makes that objection the open question rather
  than a reason to stop, so the height rule below is what this slice tests.
- The pipeline was already pure (feature-band-consumers.md): a band needs
  plugin-features's build, pack, fit, paint and pick over plain data, and
  supplies its own reactivity and height budget.

## Decision

Three parts are slice one's and provisional, to be settled when the two
displays merge, which amends them rather than contradicting them: the height
rule (taken from the rows), `records.show` defaulting to `false`, and the
admission rule below.

- **Over genotype rows the band is the structural variants** (provisional).
  A record with an SV class (`svClassOf`: a symbolic allele, a breakend, or a
  sequence-resolved allele of `SV_MIN_LENGTH` or more) is drawn; an SNV or
  small indel is not, so a region without SVs spends 0 px. With no genotype
  rows drawn (a sites-only VCF), the band is the only drawing of the records
  and draws every one the display's filter admits, stating no carriers. One
  predicate, `svOnly` in `buildRecordsRenderData`. The worker keeps a
  sample-less VCF's sites at genomic positions (`keepSampleLessSites` in
  `analyzeVariants`), which every site test, reading called alleles, dropped. The worker carries each
  record's class in the payload (`VariantFeatureInfo.svType`, the `svType`
  field `hasSvType` reads), the one source for both the filter and the color.
- **A record is not a genotype.** Under the genotype colors (no
  `encoding.color`) a record takes its SV class's color from the `svType`
  preset and the key lists the classes present as an "SV type" section above
  the genotypes; a picked `encoding.color` paints the records as it paints
  the cells. The genotype key's "Alt, full dosage" teal named no record.
- **One label line.** The ID and description are one label, so a
  description costs no row; the band packs at the compact display mode. The
  label pipeline places a description under its name, so the ladder cannot
  drop the description part alone: past the cap, names thin and go whole.
- **Each record says how many people carry it**: its label ends with the
  share and the hover breaks it down into carriers, non-carriers and no-calls
  (`recordCarriers.ts`). A sample calling one of the record's structural ALT
  alleles carries it, once in either row unit; at an un-decomposed site a
  small allele beside the SV carries nothing (`VariantFeatureInfo.svAlleles`,
  the per-allele half of `svClassOf`, set in the worker). The share is of every sample shown as a row
  (`recordCarrierSamples`), no-calls included (Colin, 2026-10-30), so it
  matches the matrix under the band. Counted
  on the main thread from each record's `genotypeCodes`, once per payload and
  row set.
- **`records: { show, growMaxHeight, labels }`** on
  `LinearMultiSampleVariantDisplay`. `growMaxHeight` and not `height`: under
  ADR-232 a fixed band's `height` is its reserved height, and this band's
  height is its content up to a cap, the word LinearBasicDisplay and
  LinearVariantDisplay already use for that. `show` defaults to `false`
  (provisional); default-on is Colin's open call.
- **Height** (provisional): the `full` rung's packed height at compact feature
  size, capped at `growMaxHeight`, taken from `availableHeight` like the
  connector zone (`variantTopBandsGeometry`). Past the cap, LinearBasicDisplay's
  ladder fits the stack in. The seam drag writes `growMaxHeight` from the drawn
  height, except that a drag down on a band shorter than its cap keeps the
  cap: such a band cannot grow, and lowering the cap to it would squeeze the
  next, taller stack.
- **One ladder.** The band hosts `fitLadderViews` over a plain `FitLadderHost`
  rather than restoring the lane's four-rung copy. The host is not the display
  model: its `facet` is the sample facet.
- **Its own entry.** `@jbrowse/plugin-features/band` exports the pipeline
  functions, so the layout and fit modules load with the multi-sample
  display's lazy model, not at plugin install through the barrel (+23 modules,
  +147 KB of source in the eager closure measured the barrel way).
- **Restored from the lane**: the record tooltip (`buildRecordHit`), the
  click with no sample card, the hover box, the seam handle, the SVG band and
  the record color off the cell hue. `flattenRows` stays gone.

## Amendment: records as the whole display (2026-10-30)

Sub-slice A of the merge. Settles the admission rule and the height for the
case with no rows; over rows both stay provisional.

- **No rows, the band is the display** (`recordsOnly`): a sample listing that
  landed empty, or the new `genotypes: { show }` off. The rows take 0 px and
  `HeightModeMixin` sizes the display (`heightMode`, default `fit`, and
  `growMaxHeight`), the rule LinearBasicDisplay uses, so a sites-only VCF
  sizes as `LinearVariantDisplay` does rather than to the 170 px cap, and
  what `fixed` or a capped `grow` cannot show scrolls. Over rows the display
  keeps its `height` under every mode (`growMaxHeight` is Infinity there).
- **Admission without rows is settled**: every record the display's filter
  admits, colored `featureDefaultColor` (`encoding.color` still paints them),
  no carrier share, no key, lettered as `LinearVariantDisplay` letters them
  (normal size, the description under the name; Colin delegated the call).
  The one-line ID, description and carrier share stays for the band over
  rows. `genotypes.show` off sends an empty
  `sampleFilter`, and the worker reads no genotype for it, so a sampled VCF
  with rows off draws exactly what a sites-only one draws.
- **Labels read the records on screen** (`labelVisibility` over
  `recordsOnScreenIds`), with or without rows; **the fit and height read them
  only with no rows**, as a feature track measures. Over rows they measure
  every fetched record, so the band, and the rows under it, hold still on a
  pan between fetches. Labelling every record was the band's whole cost: at
  a 10 kb ClinVar window the fit ladder spent 260 ms; measuring buffered
  records with no rows turned a pan off 99k of them into 64 s.
- **A click reads the record off the adapter** (`GetBasicFeatureDetails`),
  over its first base, last click winning, so the widget shows its INFO, for
  a record and for a genotype cell; its `samples` only with no rows.

Measured against `LinearVariantDisplay` in headed Chrome (WebGL2, dev
server), medians of 3, ms; reference/MULTI_SAMPLE_VARIANTS.md has the
table. At gene scale (ClinVar 10 kb, gnomAD 6 kb) navigation and pan long
tasks match within noise. At an 11 Mb ClinVar window (39k records, which
`LinearVariantDisplay` refuses at its density gate unless forced) navigation
is 1.5x the forced feature track, most of it the cell RPC, pan long tasks
equal.

## Rejected alternatives

| Alternative | Why not |
| --- | --- |
| Restore the lane's private four-rung ladder | A second fit ladder drifts from the feature track's; hosting the one ladder costs a host object |
| Spread the ladder into the display model's views | The model's `facet` is the sample facet, which the ladder would read as a feature facet |
| Export the pipeline from plugin-features's barrel | Pulls layout and fit into every product's eager closure, the circular-view embed's included |
| Extract the pipeline into a package now | The chain is already pure, so a package later is an import rename; this slice tests the height rule |
| Draw records-only through `RenderFeatureData` and the GPU path | Paint was 8 ms of the band's 550 ms; the rest was labelling records the feature track's density rule leaves bare, and `LinearVariantDisplay` packs on the main thread too |

## Consequences

- **The height rule is the open question.** Taken from the rows, a 170px band
  over a 290px, 40-sample matrix leaves rows ~2.5px. SNVs no longer cost any
  (they stacked ~12 nameless rows at 50 kb before the band dropped them). At
  RHD (1:25,200,000-25,400,000) the stack is 143px, down from 277px when it
  drew two label lines at normal size. Adding the band to the display instead
  would change `availableHeight` and the track's height plumbing, not the
  band.
- **The band's height moves with its data**: a pan or zoom that changes the
  stack changes where the rows start, and the band is 0 until a payload lands.
- **A package later** would hold `plugins/features/src/band.ts`'s modules:
  `buildFeatureRenderData` and the glyph builders under
  `RenderFeatureDataRPC/`, `layout.ts`, `packRef.ts`, `layoutInputs.ts`,
  `layoutQueries.ts`, `applyLayout.ts`, `fitLadder.ts`, `fitLadderViews.ts`,
  `components/hitTesting.ts`, `components/labelPositioning.ts`,
  `components/paintLabels.ts`, `components/paintFeatureBand.ts` and
  `marks/basicFeatureMarks.ts`, with LinearBasicDisplay consuming it too.
