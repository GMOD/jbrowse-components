import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension'
import DensityRendererF from './DensityRenderer'
import GuessAdapterF from './GuessAdapter'
import LinePlotRendererF from './LinePlotRenderer'
import LinearWiggleDisplayF, {
  ReactComponent as LinearWiggleDisplayReactComponent,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay'
import MultiDensityRendererF from './MultiDensityRenderer'
import MultiLineRendererF from './MultiLineRenderer'
import MultiLinearWiggleDisplayF from './MultiLinearWiggleDisplay'
import MultiQuantitativeTrackF from './MultiQuantitativeTrack'
import MultiRowLineRendererF from './MultiRowLineRenderer'
import MultiRowXYPlotRendererF from './MultiRowXYPlotRenderer'
import MultiWiggleAdapterF from './MultiWiggleAdapter'
import MultiWiggleAddTrackWorkflowF from './MultiWiggleAddTrackWorkflow'
import MultiXYPlotRendererF from './MultiXYPlotRenderer'
import QuantitativeTrackF from './QuantitativeTrack'
import {
  MultiWiggleClusterScoreMatrix,
  MultiWiggleGetScoreMatrix,
  MultiWiggleGetSources,
  WiggleGetGlobalQuantitativeStats,
  WiggleGetMultiRegionQuantitativeStats,
} from './WiggleRPC/rpcMethods'
import XYPlotRendererF, {
  ReactComponent as XYPlotRendererReactComponent,
  XYPlotRenderer,
  configSchema as xyPlotRendererConfigSchema,
} from './XYPlotRenderer'
import * as utils from './util'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    MultiWiggleAdapterF(pm)
    BigWigAdapterF(pm)
    QuantitativeTrackF(pm)
    MultiQuantitativeTrackF(pm)
    LinearWiggleDisplayF(pm)
    MultiLinearWiggleDisplayF(pm)
    LinePlotRendererF(pm)
    XYPlotRendererF(pm)
    DensityRendererF(pm)
    MultiXYPlotRendererF(pm)
    MultiRowXYPlotRendererF(pm)
    MultiDensityRendererF(pm)
    MultiLineRendererF(pm)
    MultiRowLineRendererF(pm)
    MultiWiggleAddTrackWorkflowF(pm)
    CreateMultiWiggleExtensionF(pm)
    GuessAdapterF(pm)

    pm.addRpcMethod(() => new WiggleGetGlobalQuantitativeStats(pm))
    pm.addRpcMethod(() => new WiggleGetMultiRegionQuantitativeStats(pm))
    pm.addRpcMethod(() => new MultiWiggleGetSources(pm))
    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }

  exports = {
    LinearWiggleDisplayReactComponent,
    XYPlotRendererReactComponent,
    XYPlotRenderer,
    linearWiggleDisplayModelFactory,
    xyPlotRendererConfigSchema,
    utils,
  }
}

export * from './util'

export { default as WiggleRendering } from './WiggleRendering'
export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  Tooltip,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay'
export type { TooltipContentsComponent } from './Tooltip'

export type {
  MultiRenderArgsDeserialized,
  RenderArgsDeserialized,
  RenderArgsDeserializedWithFeatures,
} from './types'
