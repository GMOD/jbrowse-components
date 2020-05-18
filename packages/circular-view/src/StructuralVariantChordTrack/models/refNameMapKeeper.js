import { getSession } from '@gmod/jbrowse-core/util'
import { getTrackAssemblyNames } from '@gmod/jbrowse-core/util/tracks'
import { getConf } from '@gmod/jbrowse-core/configuration'

export default pluginManager => {
  const { types } = pluginManager.lib['mobx-state-tree']

  const model = types.model('RefNameMap', {}).views(self => ({
    get refNameMap() {
      const assemblyName = getTrackAssemblyNames(self)[0]
      const adapter = getConf(self, 'adapter')
      return getSession(self)
        .assemblyManager.get(assemblyName)
        .getRefNameMapForAdapter(adapter)
    },
  }))

  return model
}
