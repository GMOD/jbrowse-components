---
title: Migrating a v4 config
description: The v5 slot each v4.3.0 config and session key becomes
guide_category: Core configuration
---

JBrowse v5 opens a v4.3.0 `config.json` or saved session unedited. As the file
loads, the app rewrites each retired key into the slot that replaced it. The
table below lists every key the app rewrites, and a script generates it by
running each rewrite.

- **In:** a v4.3.0 key on an adapter, track, display or view
- **Out:** the v5 slot that key becomes, or **dropped** where v5 reads the key
  and discards it

[`jbrowse validate`](/docs/cli#jbrowse-validate) warns on each of these keys in
a file, and fails on a key it does not know.

- **(session)** marks a key a saved session wrote on a display or view. The
  session migration writes it into the track's config, or onto the view.
- A `type` row is a v4 display type. It loads as the display named, with the
  settings listed.
- A dotted path is a nested slot: `pileup.mark.height` is
  `{ "pileup": { "mark": { "height": 7 } } }`.
- "on `LinearSyntenyView`" means the setting moves from the display to the view.

<!-- BEGIN GENERATED V4_CONFIG_MIGRATION -->

<!-- prettier-ignore -->
| Type | v4.3.0 key | v5 |
| --- | --- | --- |
| `BamAdapter` | `chunkSizeLimit` | dropped |
| `BamAdapter`, `CramAdapter`, `HtsgetBamAdapter` | `sequenceAdapter` | dropped |
| `CytobandAdapter` | `cytobandsLocation` | `cytobandLocation` |
| `FromConfigAdapter`, `FromConfigRegionsAdapter`, `FromConfigSequenceAdapter` | `featureClass` | dropped |
| `GCContentAdapter` | `windowDelta` | `step` |
|  | `windowSize` | `window` |
| `HicAdapter` | `resolutionMultiplier` | dropped |
| `MCScanAnchorsAdapter` | `subadapters` | dropped |
| `NcbiSequenceReportAliasAdapter` | `useUcscNameOverride` | `useNameOverride` |
| `JBrowse1TextSearchAdapter`, `TrixTextSearchAdapter` | `tracks` | dropped |
| `TrixTextSearchAdapter` | `metaFilePath`, `textSearchAdapterId` | dropped |
| Every track | `rpcDriverName` | dropped |
| Every track but `ReferenceSequenceTrack` | `textSearchAdapter` | `textSearching.textSearchAdapter` |
|  | `textSearchIndexingAttributes` | `textSearching.indexingAttributes` |
| `ReferenceSequenceTrack` | `rendering` | dropped |
|  | type `LinearGCContentDisplay`, type `LinearGCContentTrackDisplay`, type `MultiLinearWiggleDisplay` | dropped |
| `SyntenyTrack` | `trackIds` | dropped |
| Every display but `ChordSyntenyDisplay`, `ChordVariantDisplay`, `DotplotDisplay`, `LinearBasicDisplay`, `LinearReferenceSequenceDisplay`, `LinearSyntenyDisplay`, `LinearVariantDisplay` | `maxFeatureScreenDensity`, `mouseover` | dropped |
| Every display but `ChordSyntenyDisplay`, `ChordVariantDisplay`, `DotplotDisplay`, `LinearReferenceSequenceDisplay`, `LinearSyntenyDisplay` | `maxDisplayedBpPerPx` | dropped |
| Every display but `ChordSyntenyDisplay`, `ChordVariantDisplay`, `DotplotDisplay`, `LinearSyntenyDisplay` | `heightPreConfig` (session) | `height` |
| `ChordSyntenyDisplay`, `ChordVariantDisplay`, `DotplotDisplay`, `LinearSyntenyDisplay` | `heightPreConfig` (session) | dropped |
| `ChordVariantDisplay` | `strokeColor` | `encoding.color.value` |
|  | `strokeColorHover`, `strokeColorSelected` | dropped |
| `ChordVariantDisplay`, `LinearVariantDisplay` | `renderer` | `encoding.color.value` |
| `DotplotDisplay` | `alpha` (session) | `encoding.opacity` on `DotplotView` |
|  | `colorBy` (session) | `encoding.color.field` on `DotplotView` |
|  | `minAlignmentLength` (session) | `filter` on `DotplotView` |
| `DotplotDisplay`, `LinearHicDisplay`, `LinearReferenceSequenceDisplay`, `LinearSyntenyDisplay` | `renderer` | dropped |
| `LDTrackDisplay` | `fitToHeight` | `heightMode` |
|  | `ldMetric` | `encoding.color.field` |
|  | `showLegend` | `legend.show` |
|  | `showVerticalGuides` | `guides.show` |
|  | `useGenomicPositions` | `variantLayout` |
|  | `callRateFilter`, `hweFilterThreshold`, `lengthCutoffFilter`, `minorAlleleFrequencyFilter`, `recombinationZoneHeight`, `showLDTriangle`, `showRecombination`, `signedLD` | dropped |
| `LDTrackDisplay`, `LGVSyntenyDisplay`, `LinearAlignmentsDisplay` | `colorScheme` | dropped |
| `LDTrackDisplay`, `LGVSyntenyDisplay`, `LinearAlignmentsDisplay`, `LinearMafDisplay`, `LinearWiggleDisplay`, `MultiWaySyntenyDisplay` | `jexlFilters` | dropped |
| `LDTrackDisplay`, `LinearBasicDisplay` | `showLabels` | `labels.name.show` |
| `LDTrackDisplay`, `LinearBasicDisplay`, `LinearVariantDisplay` | `maxHeight` | dropped |
| `LDTrackDisplay`, `LinearHicDisplay`, `LinearWiggleDisplay` | `fetchSizeLimit` | dropped |
| `LGVSyntenyDisplay` | `colorBy` | `encoding.color.field` |
| `LGVSyntenyDisplay`, `LinearAlignmentsDisplay` | `autoscale` | `coverage.encoding.y.scale.fenceQuantile` |
|  | `featureHeight` | `pileup.mark.height` |
|  | `hideMismatches` | `pileup.mismatches.show` |
|  | `lineWidth` | `readConnections.encoding.strokeWidth.value` |
|  | `maxHeight` | `pileup.maxLayoutHeight` |
|  | `maxScore` | `coverage.encoding.y.scale.domainMax` |
|  | `minScore` | `coverage.encoding.y.scale.domainMin` |
|  | `mismatchAlpha` | `pileup.mismatches.encoding.opacity.field` |
|  | `pileupDisplay` | `pileup.mark.height`, `pileup.maxLayoutHeight` |
|  | `renderers` | `pileup.mark.height`, `pileup.maxLayoutHeight`, `pileup.mismatches.encoding.opacity.field`, `pileup.mismatches.show` |
|  | `scaleType` | `coverage.encoding.y.scale.type` |
|  | `snpCoverageDisplay` | `coverage.encoding.y.scale.domainMin`, `coverage.height` |
|  | `defaultRendering`, `hideLargeIndels`, `hideSmallIndels`, `jitter`, `minSubfeatureWidth`, `multiTicks` | dropped |
| `LGVSyntenyDisplay`, `LinearAlignmentsDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay` | `inverted`, `numStdDev` | dropped |
| `LinearAlignmentsDisplay` | `colorBy` | `encoding.color.field`, `pileup.bases.encoding.color.field`, `pileup.bases.show` |
|  | type `LinearPileupDisplay` | `LinearAlignmentsDisplay` with `coverage.show: false`, `sashimi.show: false` |
|  | type `LinearReadArcsDisplay` | `LinearAlignmentsDisplay` with `pileup.show: false`, `coverage.show: false`, `sashimi.show: false`, `readConnections.show: true` |
|  | type `LinearReadCloudDisplay` | `LinearAlignmentsDisplay` with `pileup.show: false`, `coverage.show: false`, `sashimi.show: false`, `readConnections.show: true`, `readConnections.mark: "rule"` |
|  | type `LinearSNPCoverageDisplay` | `LinearAlignmentsDisplay` with `pileup.show: false`, `coverage.height: 100`, `height: 100` |
|  | `autoscale` (session) | `coverage.encoding.y.scale.fenceQuantile` |
|  | `colorBy` (session), `colorBySetting` (session) | `encoding.color.field`, `pileup.bases.encoding.color.field`, `pileup.bases.show` |
|  | `constraints` (session) | `coverage.encoding.y.scale.domainMax`, `coverage.encoding.y.scale.domainMin` |
|  | `displayCrossHatches` (session) | `coverage.encoding.y.axis.grid` |
|  | `drawProperPairs` (session) | `readConnections.ordinaryPairs.show` |
|  | `drawSingletons` (session), `filterBy` (session), `filterBySetting` (session) | `filter` |
|  | `hideMismatchesSetting` (session) | `pileup.mismatches.show` |
|  | `PileupDisplay` (session) | `encoding.color.field`, `pileup.maxLayoutHeight` |
|  | `scale` (session) | `coverage.encoding.y.scale.type` |
|  | `SNPCoverageDisplay` (session) | `coverage.encoding.y.axis.grid`, `coverage.encoding.y.scale.type` |
|  | `snpCovHeight` (session) | `coverage.height` |
|  | `sortedBy` (session) | `sort.field`, `sort.pos`, `sort.refName` |
|  | `trackMaxHeight` (session) | `pileup.maxLayoutHeight` |
| `LinearAlignmentsDisplay`, `LinearHicDisplay` | `showLegend` (session) | `legend.show` |
| `LinearArcDisplay` | `color`, `renderer` | dropped |
| `LinearBasicDisplay` | `color3` | `utrs.encoding.color.value` |
|  | `containerTypes` | `containers.types` |
|  | `displayMode: "collapse"`, `displayMode: "reducedRepresentation"` | `displayMode: "normal"` |
|  | `featureHeight` | `mark.height` |
|  | `geneGlyphMode: "longest"`, `geneGlyphMode: "longestCoding"` | `geneGlyphMode: "representative"` |
|  | `mouseover` | `tooltip.field` |
|  | `renderer` | `encoding.color.value`, `utrs.encoding.color.value` |
|  | `showDescriptions` | `labels.description.show` |
|  | `subfeatureLabels` | `labels.subfeatures.placement`, `labels.subfeatures.show` |
|  | `transcriptTypes` | `transcripts.types` |
|  | type `LinearFeatureDisplay` | `LinearBasicDisplay` |
|  | `color2`, `impliedUTRs`, `outline` | dropped |
|  | `trackDisplayMode` (session) | `displayMode` |
| `LinearBasicDisplay`, `LinearHicDisplay`, `LinearManhattanDisplay`, `LinearMarkDisplay`, `LinearMultiRowFeatureDisplay`, `LinearVariantDisplay` | `jexlFilters` | `filter` |
| `LinearBasicDisplay`, `LinearVariantDisplay` | `color1` | `encoding.color.value` |
|  | `jexlFiltersSetting` (session) | `filter` |
| `LinearHicDisplay` | `activeNormalization` (session) | `data.normalization` |
|  | `colorScheme` (session) | `encoding.color.scale.reverse`, `encoding.color.scale.scheme` |
|  | `useLogScale` (session) | `encoding.color.scale.type` |
|  | `mode` (session) | dropped |
| `LinearHicDisplay`, `LinearWiggleDisplay` | `resolution` (session) | `data.resolution` |
| `LinearMafDisplay`, `LinearVariantDisplay`, `LinearWiggleDisplay` | `subtreeFilter` (session) | `rows.kept` |
|  | `treeAreaWidth` (session) | `axis.width` |
| `LinearMarkDisplay` | type `LinearArcDisplay` | `LinearMarkDisplay` with `marks: [{"mark":"link"}]` |
|  | type `LinearPairedArcDisplay` | `LinearMarkDisplay` with `marks: [{"mark":"link","transform":[{"type":"mate"}],"encoding":{"x2":{"refName":"mate.refName","pos":"mate.start"}}}]` |
| `LinearPairedArcDisplay` | `color`, `renderer` | dropped |
| `LinearSyntenyDisplay` | `middle` | dropped |
|  | `alpha` (session) | `encoding.opacity` on `LinearSyntenyView` |
|  | `colorBy` (session) | `encoding.color.field` on `LinearSyntenyView` |
|  | `minAlignmentLength` (session) | `filter` on `LinearSyntenyView` |
| `LinearVariantDisplay` | `colorBy` | `rowColor` |
|  | `featureHeight` | `records.mark.height` |
|  | `maxFeatureScreenDensity` | `records.maxFeatureScreenDensity` |
|  | `minorAlleleFrequencyFilter` | `filter` |
|  | `mouseover` | `records.tooltip.field` |
|  | `renderingMode` | `unit` |
|  | `showDescriptions` | `records.labels.description.show` |
|  | `showLabels` | `records.labels.name.show` |
|  | `showReferenceAlleles` | `referenceDrawingMode` |
|  | `showSidebarLabels` | `axis.labels` |
|  | `showTree` | `axis.tree` |
|  | type `LinearMultiSampleVariantDisplay`, type `MultiLinearVariantDisplay` | `LinearVariantDisplay` |
|  | type `LinearVariantMatrixDisplay` | `LinearVariantDisplay` with `variantLayout: "columns"` |
|  | `autoscale`, `maxScore`, `minScore`, `scaleType` | dropped |
|  | `jexlFilters` (session) | `filter` |
|  | `layout` (session) | `rows.sort` |
|  | `renderingModeSetting` (session) | `unit` |
| `LinearVariantDisplay`, `LinearWiggleDisplay` | `minimalTicks` | dropped |
|  | `clusterTree` (session) | `rows.tree` |
|  | `showSidebarLabelsSetting` (session) | `axis.labels` |
|  | `showTreeSetting` (session) | `axis.tree` |
| `LinearWiggleDisplay` | `autoscale` | `encoding.y.scale.fenceQuantile` |
|  | `defaultRendering` | `mark.interpolate`, `mark.type` |
|  | `displayCrossHatches` | `encoding.y.axis.grid` |
|  | `maxScore` | `encoding.y.scale.domainMax` |
|  | `minScore` | `encoding.y.scale.domainMin` |
|  | `renderers` | `encoding.color.value`, `encoding.y.field`, `mark.extent` |
|  | `scaleType` | `encoding.y.scale.type` |
|  | type `LinearGCContentDisplay`, type `LinearGCContentTrackDisplay`, type `MultiLinearWiggleDisplay` | `LinearWiggleDisplay` |
|  | `autoscale` (session) | `encoding.y.scale.fenceQuantile` |
|  | `color` (session) | `encoding.color.value` |
|  | `constraints` (session) | `encoding.y.scale.domainMax`, `encoding.y.scale.domainMin` |
|  | `displayCrossHatches` (session) | `encoding.y.axis.grid` |
|  | `layout` (session) | `rowColor.scale.domain`, `rowColor.scale.range`, `rows.sort` |
|  | `negColor` (session), `posColor` (session) | `encoding.color.scale.range` |
|  | `rendererTypeNameState` (session) | `mark.type` |
|  | `scale` (session) | `encoding.y.scale.type` |
|  | `summaryScoreMode` (session) | `encoding.y.field`, `mark.extent` |
| `MultiLinearWiggleDisplay` | `defaultRendering` | `mark.interpolate`, `mark.type`, `rows.field` on `LinearWiggleDisplay` |
| `DotplotView` | `alpha` (session) | `encoding.opacity` |
|  | `colorBy` (session) | `encoding.color.field` |
|  | `drawCigar` (session) | `indels.show` |
| `LinearSyntenyView` | `alpha` (session) | `encoding.opacity` |
|  | `colorBy` (session) | `encoding.color.field` |
|  | `drawCigar` (session) | `indels.show` |
|  | `tracks` (session) | `levels[0].tracks` |

<!-- END GENERATED V4_CONFIG_MIGRATION -->
