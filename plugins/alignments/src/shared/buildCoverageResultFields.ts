import type { buildModTooltipData } from './buildTooltipData.ts'
import type {
  computeCoverage,
  computeNoncovCoverage,
  computeSNPCoverage,
  computeSashimiJunctions,
} from './computeCoverage.ts'
import type { computeModificationCoverage } from './computeModificationCoverage.ts'
import type { packCoverageAreaForGpu } from './packCoverageArea.ts'

export function buildCoverageResultFields(
  coverage: ReturnType<typeof computeCoverage>,
  snpCoverage: ReturnType<typeof computeSNPCoverage>,
  noncovCoverage: ReturnType<typeof computeNoncovCoverage>,
  coverageAreaPacked: ReturnType<typeof packCoverageAreaForGpu>,
  sashimi: ReturnType<typeof computeSashimiJunctions>,
  modTooltipData: ReturnType<typeof buildModTooltipData>,
  modCoverage?: ReturnType<typeof computeModificationCoverage>,
) {
  return {
    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartPos: coverage.startPos,

    snpPositions: snpCoverage.positions,
    snpYOffsets: snpCoverage.yOffsets,
    snpHeights: snpCoverage.heights,
    snpColorTypes: snpCoverage.colorTypes,

    noncovPositions: noncovCoverage.positions,
    noncovYOffsets: noncovCoverage.yOffsets,
    noncovHeights: noncovCoverage.heights,
    noncovColorTypes: noncovCoverage.colorTypes,
    noncovMaxCount: noncovCoverage.maxCount,

    indicatorPositions: noncovCoverage.indicatorPositions,
    indicatorColorTypes: noncovCoverage.indicatorColorTypes,

    modCovPositions: modCoverage ? modCoverage.positions : new Uint32Array(0),
    modCovYOffsets: modCoverage ? modCoverage.yOffsets : new Float32Array(0),
    modCovHeights: modCoverage ? modCoverage.heights : new Float32Array(0),
    modCovColors: modCoverage ? modCoverage.colors : new Uint32Array(0),

    ...coverageAreaPacked,
    ...sashimi,
    modTooltipData,
  }
}
