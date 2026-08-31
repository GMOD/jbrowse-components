import { LITERAL } from './colorClasses.ts'
import { createFeatureFloatingLabels } from './floatingLabels.ts'
import { TRANSCRIPT_PADDING_RATIO } from './glyphs/glyphUtils.ts'
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

// One gene as the worker ships it under `all`: N one-row isoforms stacked with
// the inter-transcript gap, every rect stamped with its isoform's ordinal, and
// the `IsoformStack` the fit ladder's trim reads. The ranking is the drawn
// order unless `rank` says otherwise, which is the case a trim-by-rank test
// needs and the packer's own sort otherwise gives.
export interface StackedGeneSpec {
  featureId: string
  startBp: number
  endBp: number
  isoforms: number
  name?: string
  strand?: number
  heightPx?: number
  canonicalTag?: string
  // What the worker's own collapse left, when it left fewer than the gene has.
  // A gene the user expanded ships every isoform and this count as the only
  // record of what it was opened FROM — see `IsoformStack`.
  collapsedIsoformCount?: number
  // rank per isoform, drawn order; defaults to the drawn order itself
  ranks?: number[]
  // bp span per isoform, defaults to the gene's own
  spans?: [number, number][]
  // box height per isoform, defaults to the gene's own — what a `jexl:`
  // `featureHeight` resolving against the CHILD ships (see `featureHeightPx`)
  childHeightsPx?: number[]
}

export function packStackedGenes(genes: StackedGeneSpec[]): FeatureDataResult {
  const rects: RectData[] = []
  const flatbushItems: FlatbushItem[] = []
  const floatingLabelsData = new Map<string, FeatureLabelData>()

  for (const [flatbushIdx, spec] of genes.entries()) {
    const heightPx = spec.heightPx ?? 10
    const gapPx = heightPx * TRANSCRIPT_PADDING_RATIO
    const childHeights = Array.from(
      { length: spec.isoforms },
      (_, i) => spec.childHeightsPx?.[i] ?? heightPx,
    )
    const children = childHeights.map((childHeightPx, i) => {
      const [startBp, endBp] = spec.spans?.[i] ?? [spec.startBp, spec.endBp]
      return {
        featureId: `${spec.featureId}-${i}`,
        ordinal: i,
        isoform: true,
        rank: spec.ranks?.[i] ?? i,
        // the worker advances by each child's OWN height plus the gene's gap
        yPx: childHeights
          .slice(0, i)
          .reduce((total, above) => total + above + gapPx, 0),
        heightPx: childHeightPx,
        labelRows: 0,
        startBp,
        endBp,
      }
    })
    for (const child of children) {
      rects.push({
        start: child.startBp,
        end: child.endBp,
        y: child.yPx,
        height: child.heightPx,
        color: 0xff_80_40_ff,
        colorClass: LITERAL,
        strand: spec.strand ?? 0,
        flatbushIdx,
        labelRowsAbove: 0,
        childOrdinal: child.ordinal,
      })
    }
    const totalPx =
      childHeights.reduce((total, height) => total + height, 0) +
      Math.max(0, spec.isoforms - 1) * gapPx
    flatbushItems.push(
      makeFlatbushItem({
        featureId: spec.featureId,
        startBp: spec.startBp,
        endBp: spec.endBp,
        bottomPx: totalPx,
        featureHeightPx: totalPx,
        name: spec.name ?? spec.featureId,
        strand: spec.strand,
        isoformStack: {
          isoformCount: spec.isoforms,
          canonicalTag: spec.canonicalTag,
          collapsedIsoformCount: spec.collapsedIsoformCount,
          boxHeightPx: heightPx,
          children,
        },
      }),
    )
    floatingLabelsData.set(spec.featureId, {
      featureId: spec.featureId,
      minX: spec.startBp,
      maxX: spec.endBp,
      topY: 0,
      featureHeight: totalPx,
      ...createFeatureFloatingLabels({
        name: spec.name ?? spec.featureId,
        description: undefined,
      }),
    })
  }

  return makeFeatureData({
    ...packRenderArrays(rects, [], [], 0, Number.MAX_SAFE_INTEGER),
    flatbushItems,
    floatingLabelsData,
    featureCount: genes.length,
    hasMultiIsoformGenes: genes.some(g => g.isoforms > 1),
    labelKinds: { name: true, description: false, subfeature: false },
  })
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
