import Plugin from '@jbrowse/core/Plugin'

import ArcGetFeaturesRPCMethodsF from './ArcGetFeaturesRPC/index.ts'
import LinearArcDisplayF from './LinearArcDisplay/index.ts'
import LinearPairedArcDisplayF from './LinearPairedArcDisplay/index.ts'
import { addArcJexlFunctions } from './arcJexlFunctions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { addArcJexlFunctions } from './arcJexlFunctions.ts'

export default class ArcPlugin extends Plugin {
  name = 'ArcRenderer'
  install(pluginManager: PluginManager) {
    LinearArcDisplayF(pluginManager)
    LinearPairedArcDisplayF(pluginManager)
    ArcGetFeaturesRPCMethodsF(pluginManager)
    addArcJexlFunctions(pluginManager)
  }
}
