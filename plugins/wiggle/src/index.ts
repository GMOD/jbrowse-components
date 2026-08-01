import Plugin from '@jbrowse/core/Plugin'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import CreateMultiWiggleExtensionF from './CreateMultiWiggleExtension/index.ts'
import GuessAdapterF from './GuessAdapter/index.ts'
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
    GuessAdapterF(pm)
    RenderWiggleDataRPCF(pm)
    RenderMultiWiggleDataRPCF(pm)

    pm.addRpcMethod(() => new MultiWiggleGetScoreMatrix(pm))
    pm.addRpcMethod(() => new MultiWiggleClusterScoreMatrix(pm))
  }

  exports = {
    utils,
  }
}

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
  YSCALEBAR_LABEL_OFFSET,
  autoscaleDomainFromStats,
  computeAutoscaleDomain,
  computeScoreExtent,
  computeScoreStats,
  domainFromStats,
  featuresToRaw,
  formatScore,
  getEffectiveScores,
  getFilename,
  getNiceDomain,
  getOrigin,
  getScale,
  makeScoreNormalizer,
  processFeaturesFromArrays,
  toP,
} from './util.ts'
export type {
  Dataset,
  EditableSource,
  FeatureArrays,
  RawFeatureArrays,
  ScaleOpts,
  ScoreStats,
  Source,
  SourceInfo,
  WiggleDataResult,
  WiggleFeatureArrays,
  WiggleFeatureUnderMouse,
  WiggleSourceData,
  WiggleTooltipRow,
} from './util.ts'

export {
  ReactComponent as LinearWiggleDisplayReactComponent,
  configSchema as linearWiggleDisplayConfigSchema,
  modelFactory as linearWiggleDisplayModelFactory,
} from './LinearWiggleDisplay/index.ts'

export { WiggleCommonMixin } from './shared/WiggleCommonMixin.ts'
export { WiggleScoreConfigMixin } from './shared/WiggleScoreConfigMixin.ts'
export { SMALL_POINT_MAX_DIAMETER_PX } from './shared/wiggleComponentUtils.ts'
export {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from './shared/WiggleFamilySvg.tsx'
export type {
  WiggleFamilySvgModel,
  WiggleFamilySvgLayout,
} from './shared/WiggleFamilySvg.tsx'
export { useWiggleMouseHandlers } from './shared/useWiggleMouseHandlers.ts'
export type { WiggleDisplayModel } from './LinearWiggleDisplay/components/wiggleDisplayTypes.ts'
export type { MultiWiggleDisplayModel } from './MultiLinearWiggleDisplay/components/multiWiggleDisplayTypes.ts'

export type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'
