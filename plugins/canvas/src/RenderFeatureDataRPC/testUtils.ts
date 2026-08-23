import { LITERAL } from './colorClasses.ts'
import { packRenderArrays } from './packRenderArrays.ts'

import type { RectData } from './packRenderArrays.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
  FeatureLabelData,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from './rpcTypes.ts'

// `floatingLabelsData` is a Map in the render contract, but a fixture reads far
// better as a literal keyed by feature id. Tests build one of these instead of
// spelling out nested Map constructor arrays.
export function labelsMap(
  entries: Record<string, FeatureLabelData>,
): FloatingLabelsDataMap {
  return new Map(Object.entries(entries))
}

export function mockDisplayConfig(
  overrides: Partial<DisplayConfig> = {},
): DisplayConfig {
  return {
    featureHeight: 10,
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    canonicalTranscriptField: 'tag',
    canonicalTranscriptTags: ['MANE Select', 'RefSeq Select'],
    containerTypes: [],
    geneGlyphMode: 'all',
    maxIsoforms: undefined,
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: true,
    displayDirectionalChevrons: true,
    mouseover: `jexl:get(feature,'name')||get(feature,'id')`,
    jexlFilters: [],
    hideSourceFeatures: true,
    // the `maybeColor` slots default to unset, as a real config does
    color: undefined,
    connectorColor: undefined,
    utrColor: undefined,
    outlineColor: '',
    labels: {
      name: '',
      description: '',
    },
    ...overrides,
  }
}

// Packs the rect/line/arrow typed arrays a FeatureDataResult carries from a
// minimal feature spec, using the same packRenderArrays the worker uses so
// fixtures never drift from the production field set (e.g. a newly added
// rectDensityFade). Every visible-window filter passes by default.
export function packFixtureRects(
  features: { startBp: number; endBp: number }[],
) {
  const rects: RectData[] = features.map((f, i) => ({
    start: f.startBp,
    end: f.endBp,
    y: 0,
    height: 10,
    color: 0xff_80_40_ff,
    colorClass: LITERAL,
    strand: 0,
    flatbushIdx: i,
    labelRowsAbove: 0,
  }))
  return packRenderArrays(rects, [], [], 0, Number.MAX_SAFE_INTEGER)
}

// A hit-test FlatbushItem with sensible defaults; override what a test cares
// about. Keeps every fixture in sync with the field set (e.g. densityFade).
export function makeFlatbushItem(
  overrides: Partial<FlatbushItem> & Pick<FlatbushItem, 'featureId'>,
): FlatbushItem {
  return {
    kind: 'feature',
    type: 'gene',
    startBp: 0,
    endBp: 10,
    topPx: 0,
    bottomPx: 10,
    featureHeightPx: 10,
    tooltip: overrides.featureId,
    densityFade: false,
    ...overrides,
  }
}

// The subfeature twin of makeFlatbushItem — an isoform/mature-peptide/subpart
// hit entry. `transcript` is deliberately absent by default: a subfeature only
// carries exon geometry when the glyph that registered it was transcript-shaped,
// and the hover's accession/coordinate pairing turns on exactly that (see
// hoverReadout's hitTranscriptAndName).
export function makeSubfeatureInfo(
  overrides: Partial<SubfeatureInfo> &
    Pick<SubfeatureInfo, 'featureId' | 'parentFeatureId'>,
): SubfeatureInfo {
  return {
    kind: 'subfeature',
    type: 'mRNA',
    startBp: 0,
    endBp: 10,
    topPx: 0,
    bottomPx: 10,
    ...overrides,
  }
}

// One residue of the amino-acid overlay. `isStopOrNonTriplet` defaults off the
// letter so a fixture spelling `*` reads as a stop without having to say so
// twice.
export function makeAminoAcidOverlayItem(
  overrides: Partial<AminoAcidOverlayItem> &
    Pick<AminoAcidOverlayItem, 'aminoAcid' | 'proteinIndex'>,
): AminoAcidOverlayItem {
  return {
    startBp: 0,
    endBp: 3,
    topPx: 0,
    heightPx: 20,
    isStopOrNonTriplet: overrides.aminoAcid === '*',
    isTranslExcept: false,
    flatbushIdx: 0,
    labelRowsAbove: 0,
    ...overrides,
  }
}

// A full FeatureDataResult built from the production packer, so tests never
// hand-maintain the ~20 empty typed arrays it carries. Override any field.
export function makeFeatureData(
  overrides: Partial<FeatureDataResult> = {},
): FeatureDataResult {
  return {
    ...packFixtureRects([]),
    flatbushItems: [],
    subfeatureInfos: [],
    floatingLabelsData: new Map(),
    outlineColor: 0,
    outlineColorClass: LITERAL,
    featureCount: 0,
    ...overrides,
  }
}
