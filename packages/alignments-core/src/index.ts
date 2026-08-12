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
  SERIF_H_PX,
  SERIF_HALF_W_PX,
  computeLabelFontSize,
  drawIndicatorTriangle,
  drawInsertionMarker,
  extractIndelsFromCs,
  extractMismatchesFromCs,
  formatInsertionLabel,
  getInsertionType,
  insertionBarWidth,
  insertionSizeAlpha,
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
export { buildSyntheticAssembly } from './buildSyntheticAssembly.ts'
export type { SyntheticAssembly } from './buildSyntheticAssembly.ts'
export { buildReadVsRefNames } from './readVsRefNaming.ts'
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
// SAM flags, CIGAR/cs parsing and the SA-tag split-read decomposition live in
// @jbrowse/cigar-utils (pure SAM/CIGAR parsing, no framework deps) and are
// imported from there. This package used to mirror them so consumers "keep one
// import site", which is the opposite of what happened: consumers used both
// specifiers, sometimes in the same file, for names that are the same value.
// One owner, named at every call site.
export { coverageLayout, interbaseBarHeightPx } from './coverageBandBox.ts'
export {
  CANVAS2D_COVERAGE,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawModCovSegments,
  drawSnpSegments,
  emptyCanvas2DCoverageBuffer,
  fillSpanRect,
  minWidthLeft,
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
  buildCoverageTooltipBin,
  computeCoverageTicks,
  coverageDepthDomain,
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
