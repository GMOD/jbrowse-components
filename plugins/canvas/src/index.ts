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
    // When a text-search result is chosen, highlight the specific feature on
    // its canvas display (not just the navigated region).
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

// The two state model factories are deliberately NOT re-exported here: a value
// edge from this barrel would keep the display model subgraph eager, which is
// the point of the lazy registration. They are reachable at
// '@jbrowse/plugin-canvas/LinearBasicDisplay/stateModel' and
// '.../baseStateModel' — the latter is what a display outside this plugin
// composes (LinearVariantDisplay does).
export {
  linearBasicDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
} from './LinearBasicDisplay/index.ts'
// The exact string `colorByMode` recognizes as "color by strand". Exported so a
// third party writing the `color` slot can produce the value the display reads
// back as strand mode rather than as an opaque jexl — @jbrowse/img pins its own
// copy against this one's literal type, so the two cannot drift.
export {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from './RenderFeatureDataRPC/featureColors.ts'
// Feature-label text and geometry, for a display outside this plugin that draws
// labels beside features and must draw them the same way. The multi-sample
// variant display's lane is the one that does: its marks are the same records a
// LinearVariantDisplay would draw, so the text, its color, its measured width,
// the font size and the left-edge clamps have to be these and not a second set.
//
// `createFeatureFloatingLabels` is the whole text half in one call — it is what
// truncates a name by length and a description by *rendered width*, drops one
// that is blank or `.`, measures at LABEL_FONT_SIZE and picks the theme's two
// label colors. Re-spelling any part of that outside this plugin is how the same
// record ends up lettered differently in two displays.
//
// What is deliberately NOT shared is the *collision* rule. This plugin resolves
// label overlap by layout — `computeLabelExtraWidth` widens each feature's
// packed box so the packer pushes a colliding neighbour onto another row. A
// single-row lane has no other row, so it culls horizontally instead. That is a
// different answer to a different question, not drift. `LABEL_PADDING_PX` is
// shared even so: it is the horizontal breathing room two labels need whatever
// resolves their overlap, and it is sized to absorb measureText's disagreement
// with the rendered font. `LABEL_BASELINE_RATIO` is the vertical counterpart —
// where a label's baseline sits inside its line box — and any canvas drawing a
// label into a box owes that conversion, this plugin's SVG export included.
export {
  LABEL_BASELINE_RATIO,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
} from './RenderFeatureDataRPC/constants.ts'
export { createFeatureFloatingLabels } from './RenderFeatureDataRPC/floatingLabels.ts'
// The label-content vocabulary, so a display outside this plugin offers the
// same five choices under the same names rather than a second spelling of the
// same setting. The variant lane admits both kinds under 'auto' and leaves the
// adaptivity to its own collision cull, having no density thresholds of its own.
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

// Types that appear in the inferred shape of the exported display models. They
// have to be reachable from this entry or tsc names them by source path in
// consumers' .d.ts — see scripts/check-declaration-leaks.ts.
export type {
  CanvasColorLegend,
  GeneGlyphNotice,
} from './LinearBasicDisplay/baseModel.ts'
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
export type { FeatureContextMenuInfo } from './LinearBasicDisplay/featureContextMenu.ts'
export type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type {
  IncrementalLayout,
  LabelRoomFactorFreeInputs,
  LayoutInputs,
  LayoutRegionData,
} from './LinearBasicDisplay/layout.ts'
export type { ShowLabelsMode } from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
export type {
  FeatureDataResult,
  FlatbushItem,
  LabelItem,
  SubfeatureInfo,
} from './RenderFeatureDataRPC/rpcTypes.ts'
export type { RegionGateMeasurement } from './shared/CanvasFeatureGateMixin.ts'
