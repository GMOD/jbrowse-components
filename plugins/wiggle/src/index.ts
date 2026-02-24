import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
import LinearWiggleDisplayF from './LinearWiggleDisplay/index.ts'
import MultiLinearWiggleDisplayF from './MultiLinearWiggleDisplay/index.ts'
import MultiQuantitativeTrackF from './MultiQuantitativeTrack/index.ts'
import MultiWiggleAdapterF from './MultiWiggleAdapter/index.ts'
import MultiWiggleAddTrackWorkflowF from './MultiWiggleAddTrackWorkflow/index.ts'
import QuantitativeTrackF from './QuantitativeTrack/index.ts'
import RenderMultiWiggleDataRPCF from './RenderMultiWiggleDataRPC/index.ts'
import RenderWiggleDataRPCF from './RenderWiggleDataRPC/index.ts'
import {
  MultiWiggleClusterScoreMatrix,
  MultiWiggleGetScoreMatrix,
  MultiWiggleGetSources,
  WiggleGetGlobalQuantitativeStats,
  WiggleGetMultiRegionQuantitativeStats,
} from './WiggleRPC/rpcMethods.ts'
import * as utils from './util.ts'

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
    MultiWiggleAddTrackWorkflowF(pm)
    CreateMultiWiggleExtensionF(pm)
    GuessAdapterF(pm)
    RenderWiggleDataRPCF(pm)
    RenderMultiWiggleDataRPCF(pm)

    pm.addRpcMethod(() => new WiggleGetGlobalQuantitativeStats(pm))
    pm.addRpcMethod(() => new WiggleGetMultiRegionQuantitativeStats(pm))
    pm.addRpcMethod(() => new MultiWiggleGetSources(pm))
    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }

  exports = {
    utils,
  }
}

export * from './util.ts'

export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  Tooltip,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay/index.ts'
export type { TooltipContentsComponent } from './Tooltip.tsx'

export type {
  MultiRenderArgsDeserialized,
  RenderArgsDeserialized,
  RenderArgsDeserializedWithFeatures,
} from './types.ts'
