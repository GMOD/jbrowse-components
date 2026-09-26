export { scalesSchema, valueScaleSchema } from './valueScaleConfigSchema.ts'
export type {
  ScalesConfigSchema,
  ValueScaleAutoscale,
  ValueScaleConfigSchema,
  ValueScaleOptions,
} from './valueScaleConfigSchema.ts'

export { getNiceDomain, getNiceScale, getScale } from './scale.ts'
export type { ScaleOpts } from './scale.ts'
export { toP } from './formatNumber.ts'

export {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  makeScoreNormalizer,
  resolveSymlogConstant,
} from './normalize.ts'

export {
  autoscaleDomainFromSpans,
  autoscaleDomainFromStats,
  computeAutoscaleDomain,
  computeScoreStats,
  computeSpanStats,
  datasetSpan,
  domainFromStats,
  getEffectiveScores,
} from './autoscale.ts'
export type {
  Dataset,
  FeatureArrays,
  ScoreSpan,
  ScoreStats,
} from './autoscale.ts'

// The y-axis geometry, named at its own subpaths rather than through the
// `@jbrowse/display-ui` barrel: the barrel reaches react-dom, and reaching it
// from here put the score math and the three config mixins behind a worker
// stub. The components that draw the axis are `./chrome`.
export { axisDrawn } from '@jbrowse/display-ui/axisPlacement'
export {
  DEFAULT_RULE_COLOR,
  SCORE_CAPTION_HEIGHT,
  YSCALEBAR_LABEL_OFFSET,
} from '@jbrowse/display-ui/yAxisConstants'
export {
  AXIS_GUTTER_WIDTH_PX,
  axisPlotBox,
  clampStrokeInsideAxis,
  scoreToAxisY,
} from '@jbrowse/display-ui/yScaleTicks'
export type {
  ValueScale,
  ValueScaleRule,
  YAxis,
  YScaleTicks,
} from '@jbrowse/display-ui'

export { computeYTicks } from './computeYTicks.ts'
export { rowLabelOffset } from './rowLabelOffset.ts'

export { resolveRenderState } from './resolveRenderState.ts'

export { visibleStatsDomain, visibleStatsRange } from './visibleStatsDomain.ts'
export type {
  SettledBlocksView,
  VisibleEntry,
  VisibleStatsDomainSpec,
  VisibleStatsRangeSpec,
} from './visibleStatsDomain.ts'

export { scoreRuleMarks, widenRangeToRules } from './scoreRuleMarks.ts'
export type { ScoreRuleMark } from './scoreRuleMarks.ts'
export {
  DEFAULT_POINT_DIAMETER_PX,
  SMALL_POINT_MAX_DIAMETER_PX,
  appendPointMarker,
} from './pointMarker.ts'

export { DEFAULT_AUTOSCALE_OPTIONS } from './autoscale.ts'
export {
  makeAutoscaleTypeSubMenu,
  makeCrossHatchItem,
  makeScaleTypeSubMenu,
  makeScoreSubMenu,
  makeSetMinMaxScoreItem,
} from './scoreMenuItems.ts'
export type {
  AutoscaleModel,
  ScoreScaleModel,
  ScoreSubMenuOptions,
} from './scoreMenuItems.ts'
export { unionRanges } from './autoscaleGroup.ts'
export { ScoreAxisMixin } from './ScoreAxisMixin.ts'
export { ScoreScaleMixin } from './ScoreScaleMixin.ts'
export type { ScoreScaleHost } from './ScoreScaleMixin.ts'
export {
  WiggleScoreConfigMixin,
  wiggleScoreConfigExtraSlots,
} from './WiggleScoreConfigMixin.ts'
export type { WiggleScoreConfigHost } from './WiggleScoreConfigMixin.ts'
export { ScoreFieldConfigMixin } from './ScoreFieldConfigMixin.ts'
export {
  DEFAULT_SCORE_FIELD,
  scoreFieldConfigSchemaFields,
} from './scoreFieldConfigSchemaFields.ts'

export {
  MAX_WIGGLE_CUTS,
  MIN_FILL_WIDTH_PX,
  NO_PREV_START,
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from './renderingBackendTypes.ts'
export type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
  WiggleRenderingType,
} from './renderingBackendTypes.ts'

export type {
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureArrays,
  WiggleSourceData,
} from './dataTypes.ts'

export { type WiggleGpuDisplayModel } from './displayModel.ts'

export { collectWiggleTransferables } from './transferables.ts'

export { DEFAULT_GAP_BREAK_MULTIPLE, gapBreakLimit } from './gapBreak.ts'
