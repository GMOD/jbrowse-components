export {
  DEFAULT_CIGAR_OP_DRAW_COLORS,
  INDICATOR_TRIANGLE_H,
  INSERTION_COLOR,
  INSERTION_SERIF_MIN_PX_PER_BP,
  LABEL_FADE_HI_RATIO,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  MIN_LABEL_OPACITY,
  MIN_PX_PER_BP_FOR_TEXT,
  MISMATCH_COLOR,
  computeLabelFontSize,
  drawIndicatorTriangle,
  drawInsertionMarker,
  extractIndelsFromCs,
  extractMismatchesFromCs,
  formatInsertionLabel,
  getInsertionType,
  insertionBarWidth,
  isCsOpChar,
  isDigit,
  labelFadeOpacity,
  textWidthForNumber,
} from './labelConstants.ts'
export type {
  CigarOpDrawColors,
  IndelEntry,
  InsertionType,
} from './labelConstants.ts'
export {
  CIGAR_D,
  CIGAR_I,
  CIGAR_N,
  getLengthOnRef,
  parseCigar2,
  parseCigar2Typed,
  visitCigarOps,
  visitCsOps,
} from '@jbrowse/cigar-utils'
export type { ClipMismatch, Mismatch } from '@jbrowse/cigar-utils'
export { buildReadVsRefTemporaryAssembly } from './buildReadVsRefTemporaryAssembly.ts'
export type { ReadVsRefTemporaryAssembly } from './buildReadVsRefTemporaryAssembly.ts'
export { buildReadVsRefNames } from './readVsRefNaming.ts'
export { getTag } from './getTag.ts'
export {
  isAbnormalPairDirection,
  pairDirection,
  splitInversion,
  splitJunctionKind,
} from './orientation.ts'
export type {
  PairDirection,
  SplitInversion,
  SplitJunctionKind,
} from './orientation.ts'
export { InstanceBuilder } from './InstanceBuilder.ts'
// SAM flags and the SA-tag split-read decomposition live in @jbrowse/cigar-utils
// (pure SAM/CIGAR parsing, no framework deps). Re-exported here so consumers
// that already depend on this package keep one import site.
export {
  SAM_FLAG_DUPLICATE,
  SAM_FLAG_FAILS_QC,
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
  SAM_FLAG_UNMAPPED,
  buildReadVsRefFeatures,
  samFlagDescriptions,
  samFlagLabels,
} from '@jbrowse/cigar-utils'
export type {
  ReadVsRefFeature,
  ReadVsRefFeatures,
  ReadVsRefInput,
  ReadVsRefMate,
} from '@jbrowse/cigar-utils'
export {
  CANVAS2D_COVERAGE,
  coverageLayout,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawModCovSegments,
  drawSnpSegments,
  emptyCanvas2DCoverageBuffer,
  packCoverageBinsCanvas2D,
} from './rendererUtils.ts'
export type { Canvas2DCoverageBuffer } from './rendererUtils.ts'
export {
  packCoverageBinsForGpu,
  packCoverageSegmentsForGpu,
  packIndicatorsForGpu,
  packInterbaseSegmentsForGpu,
  packModCovSegmentsForGpu,
  packSnpSegmentsForGpu,
} from './coverageGpuPacking.ts'
export { computeInterbaseCoverage } from './interbaseCoverage.ts'
export type { ClipEntry, InsertionEntry } from './interbaseCoverage.ts'
export { computeCoverage } from './coverageCompute.ts'
export type { CoverageGap } from './coverageCompute.ts'
export {
  YSCALEBAR_LABEL_OFFSET,
  buildCoverageTooltipBin,
  computeCoverageTicks,
  computeSNPCoverage,
  computeVisibleCoverageStats,
  countSnpsAtPosition,
  downsampleDenseMax,
  downsampleMinMax,
  downsampleStatsBins,
  findSignificantInBin,
  interbaseDepthAt,
  niceStep,
} from './coverageDownsampling.ts'
export type {
  CoverageRegion,
  CoverageStatsBins,
  CoverageTooltipBin,
  InterbaseArrays,
  MismatchEntry,
  SNPCoverageResult,
} from './coverageDownsampling.ts'
export {
  buildConsensusTally,
  computeConsensus,
  walkConsensus,
} from './consensus/computeConsensus.ts'
export type {
  ConsensusFeature,
  ConsensusOptions,
  ConsensusRegion,
  ConsensusTally,
} from './consensus/computeConsensus.ts'
export {
  computeConsensusVariants,
  variantsToVcf,
} from './consensus/consensusVariants.ts'
export type {
  ConsensusVariant,
  ConsensusVcfEntry,
} from './consensus/consensusVariants.ts'
