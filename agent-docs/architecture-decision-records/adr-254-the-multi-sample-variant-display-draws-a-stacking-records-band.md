---
status: Accepted
summary: "The multi-sample variant display draws the VCF's structural variants above its genotype rows, colored by SV type and keyed, each lettered ID and description on one line, as `records: { show, growMaxHeight, labels }`, stacked by plugin-features's own pipeline: the cell payload rebuilt as features, packed, fit by LinearBasicDisplay's fit ladder (hosted, not copied), painted by `paintFeatureBand` and picked by its hit test, through the new `@jbrowse/plugin-features/band` entry. The band grows to its stack at full feature size up to `growMaxHeight` (170) and takes that height from the rows; past the cap the ladder fits the stack in. Off by default (on since the third amendment). Slice one of merging `LinearVariantDisplay` and `LinearMultiSampleVariantDisplay` into one display with `records` and `genotypes` bands. Amends ADR-250, whose first rejected alternative this takes. Amended: with no genotype rows (no samples, or `genotypes.show` off) the band is the whole display, every record the filter admits, sized by `heightMode`, labelled and fit by the records on screen, and refused past `records.maxFeatureScreenDensity` through plugin-features's `FeatureGateMixin`. Amended again (sub-slice B, amending ADR-231): the band's cap is `records.maxHeight`, and `records` takes LinearVariantDisplay's record settings, `displayMode` (unset compact over rows, normal without), `mark`, `facet` and `tooltip.field`, with `identity` on the display's one `encoding.color`. Amended a third time: one color rule in both modes, a record's SV class color otherwise `featureDefaultColor`, the SV type key wherever an SV draws, and `records.show` on by default, a SNV-only file spending 0 px. Amended by ADR-255: the display is `LinearVariantDisplay`, the feature-based one retired into it. Amended a fifth time: over rows the band is every record too, its height added to the track above the rows rather than taken from them; past the fit ladder's last rung a record that does not fit hides (a `+N hidden` chip counts it), and past `records.maxFeatureScreenDensity` the records collapse into one row. Amended a sixth time: each band hides from a chip under the band and comes back from it, genotypes hidden on a VCF with samples leaving the band as it draws over rows, and the key sits at the top of the display. Amended a seventh time: over rows the band's height is `records.height`, written by its seam drag or once by the first layout that draws a record, and holds whatever the records in view need, replacing the `records.maxHeight` cap"
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
rule (taken from the rows), `records.show` defaulting to `false` (since
settled as `true`, the third amendment), and the admission rule below.

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
  LinearVariantDisplay already use for that. `show` defaulted to `false`
  here; the third amendment turns it on.
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
  admits, colored by the third amendment's one rule (at first
  `featureDefaultColor` alone, with no key), no carrier share, lettered as
  `LinearVariantDisplay` letters them
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
- **No rows gates on density as `LinearVariantDisplay` does**: past
  `records.maxFeatureScreenDensity` (1 record/px) the window is refused with
  the same "Too many features" banner and Force load. The display composes
  plugin-features's `FeatureGateMixin` (exported from
  `@jbrowse/plugin-features/band`, its host typed off the mixin's own
  `featureGateConfigSchemaFields` rather than the feature display's config)
  and acts only while `recordsOnly`; over rows the byte gate alone stays. The
  worker counts each region's admitted records and refuses past the budget
  before building cells, carrying the counts either way. The slot sits under
  `records` because sub-slice B moves `maxFeatureScreenDensity` there. There
  is no pre-fetch sample as the feature RPC has, so a refused window reads its
  records once per settled viewport; at ClinVar 17:40–46 Mb both displays
  refuse and Force load draws both.

Measured against `LinearVariantDisplay` in headed Chrome (WebGL2, dev
server), medians of 3, ms; reference/MULTI_SAMPLE_VARIANTS.md has the
table. At gene scale (ClinVar 10 kb, gnomAD 6 kb) navigation and pan long
tasks match within noise. At an 11 Mb ClinVar window (39k records, which
`LinearVariantDisplay` refuses at its density gate unless forced) navigation
is 1.5x the forced feature track, most of it the cell RPC, pan long tasks
equal.

## Amendment: the record settings move under `records` (2026-10-30)

Sub-slice B of the merge, amending ADR-231: `records` is a band object, and
holds what LinearVariantDisplay holds about its records, so the merge can
move those configs onto it without dropping a setting.

- **`records.growMaxHeight` is `records.maxHeight`.** The top-level
  `growMaxHeight` keeps its meaning, the track's grow ceiling as on
  alignments and LinearBasicDisplay; the band's cap over rows is
  `records.maxHeight`, a band's ceiling as ADR-231 left the word free for
  (`pileup.maxLayoutHeight` took the layout cap). `maxHeight`'s retired
  meanings are top-level only: v4's second grow ceiling on the feature
  displays, dropped (`migrateBasicConfigSnapshot`), and the alignments layout
  cap. Beta-only, so no lift.
- **`displayMode`, `mark`, `facet` and `tooltip.field`**, each the
  plugin-features or display-kit sub-schema the feature displays use
  (`featureMarkConfigSchema`, `sectionFacetConfigSchema`,
  `featureTooltipFieldSlot`). The one default that differs by mode is
  `displayMode`: unset, and resolved in `recordsDisplayMode`, `compact` over
  rows (the SV band as slice one drew it) and `normal` with none (as
  LinearVariantDisplay). Pixel-identical at ClinVar 17:43.06 Mb and RHD.
- **`records.tooltip` holds `field` alone.** The record tooltip already
  shows under the display's `tooltip.show`; a second `show` would make two
  toggles for one hover.
- **The worker reads what the band needs off the whole record**: the facet
  field and a non-default tooltip field (`recordFields` in `rpcProps`), since
  the cell payload carries no INFO. Changing either refetches, as a feature
  track's tooltip and facet do.
- **`identity` joins the display's own `encoding.color`**, not a
  `records.encoding`: the band has no color channel of its own, a record
  painting the cells' hue at full dose under a picked color, so a per-record
  color is the one channel's. As on a feature track it keys a `value`
  callback's colors, the ones `scale.domain` names.

## Amendment: one color rule, and records on by default (2026-10-30)

Before the merge (sub-slice C), from a cold review that found the band
accreting a mode switch: a record's color no longer depends on whether rows
draw, and the band no longer waits to be switched on.

- **A record takes its SV class's color, otherwise `featureDefaultColor`**,
  with rows and without, while no `encoding.color` is picked
  (`svClassColors`). A picked `encoding.color` paints the records as it
  paints the cells, in both modes.
- **The "SV type" key shows whenever records with an SV class are drawn**
  under that rule, in both modes. With no rows and no `encoding.color` the
  genotype key alone stays off, since no genotype draws.
- **`records.show` defaults to `true`** (Colin): no longer provisional. Over
  genotype rows the band admits SVs only, so a SNV-only file, or a region
  with no SV, gets a 0 px band and the rows sit where they sat with it off.
  `records: { show: false }` still turns it off.

## Amendment: one display (ADR-255, 2026-10-30)

Sub-slice C1. The display this ADR draws the band on is now
`LinearVariantDisplay`, and the feature-based `LinearVariantDisplay` it
was measured against is retired into it
([ADR-255](adr-255-one-variant-display.md)). Where the amendments above say
"as `LinearVariantDisplay` does", they mean that retired display, which is
LinearBasicDisplay's behaviour. A v4 `LinearVariantDisplay` config's record
settings lift onto `records`, and a right-clicked record offers the feature
track's zoom to, get sequence and copy rows.

## Amendment: every record over rows, the band added (2026-10-31)

Colin, on the SV-only band: "it is currently 'just showing sv' but this is
weird", and on what gives when the records do not fit, the record rows, which
"need to clearly hide/get decimated and only show if there is room for them".
Settles the two provisional rules over rows.

- **Over rows the band is every record the filter admits**, as with none:
  `svOnly` is gone. A 1-sample VCF draws labelled records over its one row,
  where it drew a 280px row and nothing above it. An SV paints after the
  small records, so it lies over them where they share a row; the packer
  places by bp, so the order moves no row.
- **The band adds its height to the track.** The display's `height` is the
  rows' slot plus `topBands.recordsHeight` (the model's `height` override),
  so the rows keep their height whatever the band holds; in a ring's band,
  whose height the host fixes, the band is still taken from the rows. The
  band's cap, `records.maxHeight`, has a floor and no ceiling
  (`RECORDS_BAND_BOUNDS`), since it no longer squeezes the rows.
- **Past the cap the record rows decimate, then hide.** The ladder drops
  descriptions, thins bodies and decimates names as before, but over rows it
  never scales the boxes: a record whose box still ends below the band is
  left unplaced (plugin-features's `unplaceBelow`, the packer's own
  `OFFSCREEN_Y` state), so nothing paints, picks, highlights or finds it. A
  `+N hidden` chip at the band's foot counts the hidden records on screen,
  and its click raises the cap to the whole stack (`showAllRecordRows`). The
  chip takes a strip at the foot only while the band leaves the records a
  chip's height above it.
- **Past `records.maxFeatureScreenDensity` (1 record/px) the records collapse
  into one row** (`recordsPackMode`). That is the density at which a feature
  track, and the records-only display, refuse the window; over rows the
  matrix under the band cannot be refused. 10,000 SNVs over 50 kb stacked
  170px of ticks with 4,201 hidden before it, and draw one 15px row after.
- **Every record states its carriers**: a sample calling any ALT carries a
  small variant, one calling a structural ALT an SV
  (`countRecordCarriers`).
- **The record hover drops the Alleles row**, which its description already
  spells, and either hover shows Length only past one base, where an
  insertion's `Length 1bp` sat over its `Insertion 209bp`.

| Alternative | Why not |
| --- | --- |
| Keep the band to SVs over rows | One table drew through two filters, and a 1-sample VCF showed no record at all |
| Take the band's height from the rows | A 170px band over a 40-sample matrix left rows ~2.5px |
| Squeeze the boxes to fit, as with no rows | Records under 2px read as nothing; a hidden row that a chip counts is visible state |
| Let a dense window stack until the cap hides the rest | 170px of ticks the matrix columns already show, with SVs among the hidden |

## Amendment: the bands hide from chips (2026-10-31)

Colin: "please make it easy to minimize the records band and the genotype
matrix", where minimizing "should basically hide it so not visible...not
collapse", and "the legend should float top left of records...currently
pinned to genotypes". Reverses sub-slice A's rule that a sampled VCF with
rows off draws what a sites-only one draws.

- **A chip row under the band** (`BandChips`): `Records ×` and
  `Genotypes ×` while both draw, `Show records` or `Show genotypes` for the
  one hidden, and the hidden-records count, which moved out of the band's
  foot. Neither hides while the other is hidden, so the track never draws
  nothing. Both write the slots the menu's checkboxes write, `records.show`
  and `genotypes.show`.
- **Genotypes hidden is not records-only.** `recordsOnly` is now a VCF with
  no samples alone; `drawsRows` is `genotypes.show` on a VCF with samples.
  With the rows hidden the band keeps its look over rows (compact, one label
  line, collapsing past the density budget rather than refusing the window),
  and the track is the band plus the chips' strip, so it shrinks. The slot
  `height` stays the rows', so they come back at the height they had. The
  menus key their row-only items on `drawsRows`, and track sizing on
  `recordsOnly`, since with the rows hidden the band sets the height.
- **The key sits at the top of the display** over the band, as on a feature
  track, rather than pushed under it (`legendTop` no longer overridden). It
  keeps the right corner every display's key floats in: the left corner is
  the track label's.

| Alternative | Why not |
| --- | --- |
| Collapse a minimized band to a labelled strip | Colin: hidden, not collapsed |
| Keep genotypes off as the sites-only look | The track kept the rows' height, so hiding shrank nothing, and the rows came back at the records' height |
| A second `minimized` state beside `show` | Two states for one choice; the chip writes the slot the menu writes |

## Amendment: the band's height is written, not capped (2026-10-31)

Colin, on `records.maxHeight`: "it does not need a maximum", and "drag sets
the height". Reverses the fifth amendment's height rule over rows; the band,
its ladder, the hiding and the chip stay.

- **`records.height` replaces `records.maxHeight`**, a slot with no
  default: a config slot drops a value equal to its default from the
  snapshot, so with 170 as the default a drag through 170 or a dense window
  settling at it read as unwritten and the band went back to following its
  stack. Once written, the band over rows is that tall whatever the records
  in view need
  (`recordsBandHeightOverRows`), so a pan from a dense window to a sparse or
  empty one moves nothing below the band. Under the cap the band followed
  its stack, so every fetch could resize the track, the grow-on-pan shift
  the height policy rules out. Floored at `MIN_RECORDS_HEIGHT`, no ceiling.
- **The seam drag writes the height and follows the pointer**: the drawn
  height at the press plus the pointer's whole travel (`RecordsSeamHandle`).
  Adding each frame's delta to the current height forgot the travel past the
  floor, so after a drag up out of the display the band grew from wherever the
  pointer turned back, far from the seam. A drag down past the stack makes
  room, where it used to keep the cap.
- **The height settles once, as the records-only height does.** Unwritten,
  the band is its stack up to the default (170), and the first layout that
  draws a record writes what it draws (`settleRecordsBandHeight`, the
  `RecordsBandHeight` autorun), genotypes hidden or not. The written height
  lands in the display's config, so a session keeps it, as a track's
  `height` does. A VCF opening on a window with no record
  spends nothing until one is in view; after that an empty window shows the
  band empty.
- **`+N hidden` sets the height to the whole stack** (`showAllRecordRows`).
- Beta-only slot, so no lift from `maxHeight`.

| Alternative | Why not |
| --- | --- |
| No cap: the band always grows to its stack | A dense SV region pushes the rows off screen, and every pan shifts the tracks below |
| A fixed default with no opening settle | Every SNV-free cohort VCF would open with 170px of empty band |
| Keep the cap and settle it | The band still shrinks on a sparse window; a cap the drag moves is not the height it set |

## Rejected alternatives

| Alternative | Why not |
| --- | --- |
| Restore the lane's private four-rung ladder | A second fit ladder drifts from the feature track's; hosting the one ladder costs a host object |
| Spread the ladder into the display model's views | The model's `facet` is the sample facet, which the ladder would read as a feature facet |
| Export the pipeline from plugin-features's barrel | Pulls layout and fit into every product's eager closure, the circular-view embed's included |
| Extract the pipeline into a package now | The chain is already pure, so a package later is an import rename; this slice tests the height rule |
| Draw records-only through `RenderFeatureData` and the GPU path | Paint was 8 ms of the band's 550 ms; the rest was labelling records the feature track's density rule leaves bare, and `LinearVariantDisplay` packs on the main thread too |
| Keep `growMaxHeight` for the band and rename the top-level one | The top-level word is the grow ceiling on every feature and alignments display |
| `records.displayMode` defaulting to one value, the other mode overriding it | A written `normal` over rows could not be told from the default; unset is the one state that resolves by mode |
| `records.tooltip` as the whole `FeatureTooltip` (`show` and `field`) | Two toggles for one hover tooltip |
| `records.encoding.color` beside the cells' | The records paint the cells' hue; two channels would color one record twice |

## Consequences

- **The height rule was the open question**, settled as added by the fifth
  amendment. Taken from the rows, a 170px band over a 290px, 40-sample
  matrix left rows ~2.5px. SNVs no longer cost any
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
