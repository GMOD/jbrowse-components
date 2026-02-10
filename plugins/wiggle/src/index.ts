import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension/index.ts'
import DensityRendererF from './DensityRenderer/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import LinePlotRendererF from './LinePlotRenderer/index.ts'
import LinearWebGLMultiWiggleDisplayF from './LinearWebGLMultiWiggleDisplay/index.ts'
import LinearWebGLWiggleDisplayF from './LinearWebGLWiggleDisplay/index.ts'
import MultiQuantitativeTrackF from './MultiQuantitativeTrack/index.ts'
import MultiWiggleAdapterF from './MultiWiggleAdapter/index.ts'
import MultiWiggleAddTrackWorkflowF from './MultiWiggleAddTrackWorkflow/index.ts'
import QuantitativeTrackF from './QuantitativeTrack/index.ts'
import RenderWebGLMultiWiggleDataRPCF from './RenderWebGLMultiWiggleDataRPC/index.ts'
import RenderWebGLWiggleDataRPCF from './RenderWebGLWiggleDataRPC/index.ts'
import {
  MultiWiggleClusterScoreMatrix,
  MultiWiggleGetScoreMatrix,
  MultiWiggleGetSources,
  WiggleGetGlobalQuantitativeStats,
  WiggleGetMultiRegionQuantitativeStats,
} from './WiggleRPC/rpcMethods.ts'
import XYPlotRendererF, {
  ReactComponent as XYPlotRendererReactComponent,
  XYPlotRenderer,
  configSchema as xyPlotRendererConfigSchema,
} from './XYPlotRenderer/index.ts'
import * as utils from './util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    MultiWiggleAdapterF(pm)
    BigWigAdapterF(pm)
    QuantitativeTrackF(pm)
    MultiQuantitativeTrackF(pm)
    LinearWebGLWiggleDisplayF(pm)
    LinearWebGLMultiWiggleDisplayF(pm)
    LinePlotRendererF(pm)
    XYPlotRendererF(pm)
    DensityRendererF(pm)
    MultiWiggleAddTrackWorkflowF(pm)
    CreateMultiWiggleExtensionF(pm)
    GuessAdapterF(pm)
    RenderWebGLWiggleDataRPCF(pm)
    RenderWebGLMultiWiggleDataRPCF(pm)

    pm.addRpcMethod(() => new WiggleGetGlobalQuantitativeStats(pm))
    pm.addRpcMethod(() => new WiggleGetMultiRegionQuantitativeStats(pm))
    pm.addRpcMethod(() => new MultiWiggleGetSources(pm))
    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }

  exports = {
    XYPlotRendererReactComponent,
    XYPlotRenderer,
    xyPlotRendererConfigSchema,
    utils,
  }
}

export * from './util.ts'

export { default as WiggleRendering } from './WiggleRendering.tsx'
export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  Tooltip,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWebGLWiggleDisplay/index.ts'
export type { TooltipContentsComponent } from './Tooltip.tsx'

export type {
  MultiRenderArgsDeserialized,
  RenderArgsDeserialized,
  RenderArgsDeserializedWithFeatures,
} from './types.ts'
