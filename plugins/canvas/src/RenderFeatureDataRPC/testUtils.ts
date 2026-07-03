import { packRenderArrays } from './packRenderArrays.ts'
import { THEME_DERIVED_COLOR } from './renderConfig.ts'

import type { RectData } from './packRenderArrays.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureDataResult, FlatbushItem } from './rpcTypes.ts'

export function mockDisplayConfig(
  overrides: Partial<DisplayConfig> = {},
): DisplayConfig {
  return {
    featureHeight: 10,
    subfeatureLabels: 'none',
    transcriptTypes: ['mRNA'],
    containerTypes: [],
    geneGlyphMode: 'all',
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: true,
    displayDirectionalChevrons: true,
    mouseover: `jexl:get(feature,'name')||get(feature,'id')`,
    jexlFilters: [],
    color: 'goldenrod',
    connectorColor: THEME_DERIVED_COLOR,
    utrColor: '#357089',
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
  features: { startBp: number; endBp: number; densityFade?: boolean }[],
) {
  const rects: RectData[] = features.map((f, i) => ({
    start: f.startBp,
    end: f.endBp,
    y: 0,
    height: 10,
    color: 0xff_80_40_ff,
    strand: 0,
    flatbushIdx: i,
    densityFade: f.densityFade ?? false,
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

// A full FeatureDataResult built from the production packer, so tests never
// hand-maintain the ~20 empty typed arrays it carries. Override any field.
export function makeFeatureData(
  overrides: Partial<FeatureDataResult> = {},
): FeatureDataResult {
  return {
    ...packFixtureRects([]),
    flatbushItems: [],
    subfeatureInfos: [],
    floatingLabelsData: {},
    outlineColor: 0,
    featureCount: 0,
    ...overrides,
  }
}
