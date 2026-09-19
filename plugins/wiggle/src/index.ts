import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension/index.ts'
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
} from './WiggleRPC/rpcMethods.ts'

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
    RenderWiggleDataRPCF(pm)
    RenderMultiWiggleDataRPCF(pm)

    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }
}

export type { RawFeatureArrays, WiggleHoveredFeature } from './util.ts'

// The state model factory is deliberately NOT re-exported here: a value edge
// from this barrel would keep the display model subgraph eager, which is the
// point of the lazy registration. It is reachable at
// '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel', which is where
// gccontent's displays compose it.
export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  configSchema as linearWiggleDisplayConfigSchema,
} from './LinearWiggleDisplay/index.ts'

// The bedGraph writer QuantitativeTrack and MultiQuantitativeTrack register as
// their save-file format. Exported because gccontent's track offers the same
// download of the same four columns, and had its own copy.
export { bedGraphFormatOptions } from './saveTrackFormats/bedGraph.ts'
export type { DensityRampName } from './shared/densityColorRamp.ts'
// The one slot every score-summarizing display declares with a different
// default, so gccontent states its default without restating the enumeration.
export { summaryScoreModeConfigSchemaFields } from './shared/summaryScoreModeConfigSchemaFields.ts'
export { wiggleCommonExtraSlots } from './shared/WiggleCommonMixin.ts'
export { wiggleMouseHandlers } from './shared/wiggleMouseHandlers.ts'
// Score-plot pieces that moved to `@jbrowse/wiggle-core`, re-exported under the
// names this plugin published them as.
export { WiggleScoreConfigMixin } from '@jbrowse/wiggle-core'
export type { ScorePlotSvgModel as WiggleFamilySvgModel } from '@jbrowse/wiggle-core/ScorePlotSvgFrame'
export type { MultiWiggleDisplayModel } from './MultiLinearWiggleDisplay/components/multiWiggleDisplayTypes.ts'
