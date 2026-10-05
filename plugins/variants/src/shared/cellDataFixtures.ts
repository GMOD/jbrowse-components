import Flatbush from '@jbrowse/core/util/flatbush'

import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { VariantFeatureInfo } from './types.ts'

/** A record's info with every field a tooltip reads, `overrides` on top. */
export function featureInfoOf(
  featureId: string,
  overrides?: Partial<VariantFeatureInfo>,
): VariantFeatureInfo {
  return {
    featureId,
    ref: 'A',
    alt: ['T'],
    name: featureId,
    description: '',
    length: 1,
    insertedBp: 0,
    type: 'SNV',
    genotypeCodes: new Uint32Array(0),
    ...overrides,
  }
}

/**
 * A payload of these records and no cells, `overrides` on top, its spatial
 * index built over the positions it ends up with.
 */
export function cellPayloadOf(
  featureInfo: VariantFeatureInfo[],
  overrides?: Partial<VariantCellData>,
): VariantCellData {
  const data = {
    cellFeatureIndices: new Uint32Array(0),
    cellRowIndices: new Uint32Array(0),
    cellColors: new Uint32Array(0),
    cellAltDosage: new Uint8Array(0),
    numCells: 0,
    refCellCount: 0,
    paintedCategories: 0,
    featureColorValues: new Uint32Array(featureInfo.length),
    colorValues: [],
    paintedColorValues: [],
    featureInfo,
    featurePositions: new Uint32Array(featureInfo.length * 2),
    featureInsertedBp: new Int32Array(featureInfo.length),
    ...overrides,
  }
  const n = featureInfo.length
  const index = new Flatbush(Math.max(n, 1), 16, Uint32Array)
  for (let f = 0; f < Math.max(n, 1); f++) {
    index.add(
      data.featurePositions[f * 2] ?? 0,
      0,
      data.featurePositions[f * 2 + 1] ?? 0,
      1,
    )
  }
  index.finish()
  return { ...data, featureIndexData: index.data }
}

/** A fetch result with no samples and no payloads, `overrides` on top. */
export function cellDataOf(
  overrides?: Partial<CellDataResult>,
): CellDataResult {
  return {
    samplePloidy: {},
    rowNames: [],
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    colorRead: undefined,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    simplifiedFeatures: [],
    genotypeDict: [],
    sampleNames: [],
    perRegionCellData: {},
    ...overrides,
  }
}
