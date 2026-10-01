import Plugin from '@jbrowse/core/Plugin'

import LinearMarkDisplayF from './LinearMarkDisplay/index.ts'
import MarkRowsRPCF from './MarkRowsRPC/index.ts'
import MarkScanPlotFields from './MarkScanPlotFields.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { ReactComponent as LinearMarkDisplayReactComponent } from './LinearMarkDisplay/index.ts'
export {
  configSchemaFactory as linearMarkDisplayConfigSchemaFactory,
  markListSchema,
} from './LinearMarkDisplay/configSchema.ts'
export { markLayerRequest } from './LinearMarkDisplay/markRequest.ts'
export { stepChannels } from './LinearMarkDisplay/stepChannels.ts'
export type {
  LinearMarkDisplayConfigModel,
  MarkConfig,
  MarkTransformStepConfig,
} from './LinearMarkDisplay/configSchema.ts'
export type {
  MarkSnapshot,
  StepSnapshot,
} from './LinearMarkDisplay/markProblems.ts'
export type { SharedKey } from './LinearMarkDisplay/pinDistinct.ts'
export type { MarkColor, ValueColor } from './LinearMarkDisplay/markColor.ts'

export default class MarksPlugin extends Plugin {
  name = 'MarksPlugin'

  install(pluginManager: PluginManager) {
    LinearMarkDisplayF(pluginManager)
    MarkRowsRPCF(pluginManager)
    pluginManager.addRpcMethod(() => new MarkScanPlotFields(pluginManager))
  }
}
