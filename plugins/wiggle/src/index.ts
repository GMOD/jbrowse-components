import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension/index.ts'
import LinearWiggleDisplayF from './LinearWiggleDisplay/index.ts'
import MultiLinearWiggleDisplayF from './MultiLinearWiggleDisplay/index.ts'
import MigrateMultiWiggleConfigF from './MultiLinearWiggleDisplay/preProcessTrackConfig.ts'
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
    MigrateMultiWiggleConfigF(pm)
    MultiWiggleAddTrackWorkflowF(pm)
    CreateMultiWiggleExtensionF(pm)
    RenderWiggleDataRPCF(pm)
    RenderMultiWiggleDataRPCF(pm)

    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }

  exports = {
    utils,
  }
}

// Only what this plugin implements. The score-scaling helpers and the wiggle
// data/render types belong to `@jbrowse/wiggle-core` and are imported from
// there — mirroring them here gave the same value two import paths and no
// consumer ever took this one.
export {
  MULTI_WIGGLE_RENDERING_GROUPS,
  MULTI_WIGGLE_RENDERING_TYPES,
  SINGLE_WIGGLE_SOURCE_NAME,
  WIGGLE_FUDGE_FACTOR,
  WIGGLE_MIN_PX,
  WIGGLE_NEG_COLOR_DEFAULT,
  WIGGLE_POS_COLOR_DEFAULT,
  WIGGLE_RENDERINGS,
  WIGGLE_RENDERING_TYPES,
  featuresToRaw,
  formatScore,
  getFilename,
  processFeaturesFromArrays,
} from './util.ts'
export type {
  RawFeatureArrays,
  Source,
  WiggleHoveredFeature,
  WiggleTooltipRow,
} from './util.ts'

export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  configSchema as linearWiggleDisplayConfigSchema,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay/index.ts'

export { WiggleCommonMixin } from './shared/WiggleCommonMixin.ts'
// The bedGraph writer QuantitativeTrack and MultiQuantitativeTrack register as
// their save-file format. Exported because gccontent's track offers the same
// download of the same four columns, and had its own copy.
export {
  bedGraphFormatOptions,
  stringifyBedGraph,
} from './saveTrackFormats/bedGraph.ts'
// The score axis alone, for a display that has one without wiggle's palette and
// rendering vocabulary (GWAS Manhattan), plus the snapshot remap that keeps
// retired autoscale values loading.
// re-exported from `@jbrowse/wiggle-core`, where it moved to sit beside the
// `ScoreScaleMixin` that reads it. Kept here because it is this plugin's
// published surface and gwas imports it by this path.
export { scoreAxisConfigSchemaFields } from '@jbrowse/wiggle-core'
export { remapRetiredAutoscale } from './shared/remapRetiredAutoscale.ts'
// The one slot every score-summarizing display declares with a different
// default, so gccontent states its default without restating the enumeration.
export { summaryScoreModeConfigSchemaFields } from './shared/summaryScoreModeConfigSchemaFields.ts'
export { wiggleCommonExtraSlots } from './shared/WiggleCommonMixin.ts'
export { WiggleScoreConfigMixin } from './shared/WiggleScoreConfigMixin.ts'
export {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from './shared/WiggleFamilySvg.tsx'
export type {
  WiggleFamilySvgModel,
  WiggleFamilySvgLayout,
} from './shared/WiggleFamilySvg.tsx'
export { wiggleMouseHandlers } from './shared/wiggleMouseHandlers.ts'
export { makePointSizeSubMenu } from './shared/wiggleMenuItems.tsx'
export type { WiggleDisplayModel } from './LinearWiggleDisplay/components/wiggleDisplayTypes.ts'
export type { MultiWiggleDisplayModel } from './MultiLinearWiggleDisplay/components/multiWiggleDisplayTypes.ts'
