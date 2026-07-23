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
    pluginManager.addToExtensionPoint(
      'LinearGenomeView-searchResultSelected',
      (arg, { result, model, assemblyName }) => {
        highlightSearchResultFeature({ result, model, assemblyName })
        return arg
      },
    )
  }
}

export {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayStateModelFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayStateModelFactory,
} from './LinearBasicDisplay/index.ts'
export type { LinearBasicDisplayModel } from './LinearBasicDisplay/index.ts'

// Types that appear in the inferred shape of the exported display models. They
// have to be reachable from this entry or tsc names them by source path in
// consumers' .d.ts — see scripts/check-declaration-leaks.ts.
export type { RegionDensityStats } from './LinearBasicDisplay/baseModelHelpers.ts'
export type { CanvasFeatureRenderingBackend } from './LinearBasicDisplay/components/canvasFeatureRenderingBackendTypes.ts'
export type { LinearBasicDisplayComponentProps } from './LinearBasicDisplay/components/FeatureComponent.tsx'
export type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
} from './LinearBasicDisplay/components/hitTesting.ts'
export type { LinearBasicDisplayConfigModel } from './LinearBasicDisplay/configSchema.ts'
export type {
  FeatureHighlight,
  HighlightTarget,
  ResolvedHighlights,
} from './LinearBasicDisplay/featureHighlight.ts'
export type { FitStage } from './LinearBasicDisplay/fitLadder.ts'
export type {
  IncrementalLayout,
  LayoutInputs,
} from './LinearBasicDisplay/layout.ts'
export type { ShowLabelsMode } from './LinearBasicDisplay/showLabelsMode.ts'
export type {
  DisplayConfig,
  DisplayMode,
} from './RenderFeatureDataRPC/renderConfig.ts'
export type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from './RenderFeatureDataRPC/rpcTypes.ts'
export type { RegionGateMeasurement } from './shared/CanvasFeatureGateMixin.ts'
