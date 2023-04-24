import { types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'

export default function Assemblies(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  return types.model({
    /**
     * #property
     */
    sessionAssemblies: types.array(assemblyConfigSchemasType),
    /**
     * #property
     */
    temporaryAssemblies: types.array(assemblyConfigSchemasType),
  })
}
