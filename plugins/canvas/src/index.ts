import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import { highlightSearchResultFeature } from './LinearBasicDisplay/searchResultHighlight.ts'
import LinearMultiRowFeatureDisplayF from './LinearMultiRowFeatureDisplay/index.ts'
import MultiRowClusterFeaturesRPCMethodF from './MultiRowClusterFeaturesRPC/index.ts'
import MultiRowGetFeaturesRPCMethodF from './MultiRowGetFeaturesRPC/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    LinearMultiRowFeatureDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
    MultiRowGetFeaturesRPCMethodF(pluginManager)
    MultiRowClusterFeaturesRPCMethodF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    // #region searchResultSelected
    pluginManager.listenToExtensionPoint(
      'LinearGenomeView-searchResultSelected',
      ({ result, model, assemblyName }) => {
        highlightSearchResultFeature({ result, model, assemblyName })
      },
    )
    // #endregion
  }
}

// The state model factories stay out of this barrel: a value edge from here
// would keep the display model subgraph eager, defeating the lazy registration.
export {
  linearBasicDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
} from './LinearBasicDisplay/index.ts'
// For @jbrowse/img and third parties writing the `color` slot.
export {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from './RenderFeatureDataRPC/featureColors.ts'
// Feature-label text and geometry, for a display outside this plugin that
// letters marks the same way.
export {
  LABEL_BASELINE_RATIO,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
} from './RenderFeatureDataRPC/constants.ts'
export { createFeatureFloatingLabels } from './RenderFeatureDataRPC/floatingLabels.ts'
// The label-content vocabulary, for a display outside this plugin offering the
// same choices.
export {
  SHOW_LABELS_MODES,
  modeCanShowDescription,
  modeCanShowName,
} from './LinearBasicDisplay/showLabelsMode.ts'
export { computeLabelPosition } from './LinearBasicDisplay/components/labelPositioning.ts'
export type {
  FeatureBoundsPx,
  LabelMetrics,
} from './LinearBasicDisplay/components/labelPositioning.ts'
export type {
  LinearBasicDisplayModel,
  LinearCanvasBaseDisplayModel,
} from './LinearBasicDisplay/index.ts'

// Types in the inferred shape of the exported display models: unreachable from
// this entry, tsc names them by source path in consumers' .d.ts.
export type { GeneGlyphNotice } from './LinearBasicDisplay/baseModel.ts'
export type { RegionDensityStats } from './shared/regionDensity.ts'
export type { CanvasFeatureRenderingBackend } from './LinearBasicDisplay/components/canvasFeatureRenderingBackendTypes.ts'
export type { LinearBasicDisplayComponentProps } from './LinearBasicDisplay/components/FeatureComponent.tsx'
export type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type {
  LinearBasicDisplayConfig,
  LinearBasicDisplayConfigModel,
} from './LinearBasicDisplay/configSchema.ts'
export type { LinearCanvasBaseDisplayConfigModel } from './LinearBasicDisplay/baseConfigSchema.ts'
export type { FeatureContextMenuInfo } from './LinearBasicDisplay/featureContextMenu.ts'
export type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type { FitDrops } from './LinearBasicDisplay/fitNotes.ts'
export type { IncrementalLayout } from './LinearBasicDisplay/layout.ts'
export type {
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './LinearBasicDisplay/layoutInputs.ts'
export type { ShowLabelsMode } from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
export type {
  FeatureDataResult,
  FlatbushItem,
  LabelItem,
  RegionRenderData,
  SubfeatureInfo,
} from './RenderFeatureDataRPC/rpcTypes.ts'
export type { RegionGateMeasurement } from './shared/CanvasFeatureGateMixin.ts'

// The feature glyph set as marks, for a display outside this plugin drawing
// gene glyphs under its own axis.
export { featureGlyphMarks } from './LinearBasicDisplay/marks/featureGlyphMarks.ts'
export { rectShader as featureGlyphShader } from './LinearBasicDisplay/passes/index.ts'
export type { FeatureGlyphParams } from './LinearBasicDisplay/marks/featureGlyphShapes.ts'
export { MAX_VISIBLE_CHEVRONS_PER_LINE } from './LinearBasicDisplay/components/sharedRendererConstants.ts'
// The gene glyph's shape rules, for a display outside this plugin drawing these
// glyphs through the passes above.
export {
  UTR_HEIGHT_FRACTION,
  centerShrink,
} from './RenderFeatureDataRPC/collect/emitPrimitives.ts'
export {
  featureType,
  getSubfeatures,
  isCDS,
  isExon,
  isUTR,
} from './RenderFeatureDataRPC/util.ts'
export { mergeSpans } from './shared/mergeSpans.ts'
export type { Span as GlyphSpan } from './shared/mergeSpans.ts'

// The feature band as pure functions, for the multi-sample variant display's
// lane and any other consumer drawing this plugin's data. The seam is the data,
// not the model: plain arrays, plain config, plain numbers.
export { buildFeatureRenderData } from './RenderFeatureDataRPC/buildFeatureRenderData.ts'
export {
  computeLaidOutData,
  createContentHeightProbe,
} from './LinearBasicDisplay/layout.ts'
export { scaleLaidOutData } from './LinearBasicDisplay/applyLayout.ts'
export {
  maxBottom,
  minDrawnBoxHeight,
} from './LinearBasicDisplay/layoutQueries.ts'
export {
  MIN_FIT_BOX_PX,
  resolveFitLadder,
  solveLabelRoomFactor,
  squeezeFloorScale,
} from './LinearBasicDisplay/fitLadder.ts'
export { paintFeatureBand } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export {
  buildFeatureFlatbushIndex,
  performMultiRegionHitDetection,
} from './LinearBasicDisplay/components/hitTesting.ts'
export {
  HEIGHT_MULTIPLIERS,
  labelFontSize,
} from './RenderFeatureDataRPC/glyphs/glyphUtils.ts'
export type { FeatureBandPaint } from './LinearBasicDisplay/components/paintFeatureBand.ts'
export type {
  HitFeatureResult,
  VisibleRegion,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type { DensityBandLayer } from './shared/densityBand.ts'
export type { DensityHover } from './shared/densityBandViews.ts'
