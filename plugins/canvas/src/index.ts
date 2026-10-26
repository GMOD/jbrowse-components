import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import { highlightSearchResultFeature } from './LinearBasicDisplay/searchResultHighlight.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
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
// The label parts, for a display outside this plugin labeling the same
// records: `labels.name` and `labels.description`.
export { featureNameLabelConfigSchema } from './LinearBasicDisplay/featureNameLabelConfigSchema.ts'
export { featureDescriptionLabelConfigSchema } from './LinearBasicDisplay/featureDescriptionLabelConfigSchema.ts'
// Deprecated: the five-value label mode `labels.*.show` replaced.
export {
  SHOW_LABELS_MODES,
  modeCanShowDescription,
  modeCanShowName,
} from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  LinearBasicDisplayModel,
  LinearCanvasBaseDisplayModel,
} from './LinearBasicDisplay/index.ts'
export { isLinearBasicDisplay } from './LinearBasicDisplay/isLinearBasicDisplay.ts'

// Types in the inferred shape of the exported display models: unreachable from
// this entry, tsc names them by source path in consumers' .d.ts.
export type { GeneGlyphNotice } from './LinearBasicDisplay/baseModel.ts'
export type { RegionDensityStats } from './shared/CanvasFeatureGateMixin.ts'
export type { CanvasFeatureRenderingBackend } from './LinearBasicDisplay/components/canvasFeatureRenderingBackendTypes.ts'
export type { FlatbushRegionIndexes } from './LinearBasicDisplay/components/hitTesting.ts'
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
export type {
  IncrementalLayout,
  PackHeightCache,
  PackedBottoms,
} from './LinearBasicDisplay/layout.ts'
export { layoutRegionKey } from './LinearBasicDisplay/layoutInputs.ts'
export type {
  IsoformCountFreeInputs,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
  PackKnobFreeInputs,
} from './LinearBasicDisplay/layoutInputs.ts'
export type { ShowLabelsMode } from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
// A display drawing single records lays them out with the gene half at these.
export { GENE_GLYPH_DEFAULTS } from './RenderFeatureDataRPC/renderConfig.ts'
export type {
  FeatureDataResult,
  FlatbushItem,
  RegionRenderData,
  SubfeatureInfo,
} from './RenderFeatureDataRPC/rpcTypes.ts'
export type { RegionGateMeasurement } from './shared/CanvasFeatureGateMixin.ts'
export type { GroupByCandidate } from './RenderFeatureDataRPC/groupByCandidates.ts'
export type { GroupByScanOptions } from './LinearBasicDisplay/scanGroupByCandidates.ts'

// The feature glyph set as marks, for a display outside this plugin drawing
// gene glyphs under its own axis.
export { featureGlyphMarks } from './LinearBasicDisplay/marks/featureGlyphMarks.ts'
export { keepFeatureLabel } from './LinearBasicDisplay/labelReservation.ts'
export { computeLabelLeftPx } from './LinearBasicDisplay/components/labelPositioning.ts'
export { getFeatureName } from './RenderFeatureDataRPC/labelUtils.ts'
export { FEATURE_NAME_FIELD } from './RenderFeatureDataRPC/featureNameField.ts'
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
export { impliedUTRs } from './RenderFeatureDataRPC/impliedUTRs.ts'
export { representativeIsoform } from './RenderFeatureDataRPC/glyphs/subfeatures.ts'
export type { IsoformSettings } from './RenderFeatureDataRPC/glyphs/subfeatures.ts'
export type { ImpliedUTR } from './RenderFeatureDataRPC/impliedUTRs.ts'
export { mergeSpans } from './shared/mergeSpans.ts'
export type { Span as GlyphSpan } from './shared/mergeSpans.ts'

// The feature glyph pipeline's front half as a pure function, for a display
// outside this plugin checking its own glyphs against it.
export { buildFeatureRenderData } from './RenderFeatureDataRPC/buildFeatureRenderData.ts'
