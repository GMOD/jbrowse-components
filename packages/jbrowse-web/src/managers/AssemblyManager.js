import { getSnapshot } from 'mobx-state-tree'
import { readConfObject, getConf } from '../configuration'
import { getAdapter } from '../util/dataAdapterCache'

export default class AssemblyManager {
  constructor(pluginManager, assemblies) {
    this.pluginManager = pluginManager
    this.assemblies = assemblies
    this.adapterMaps = new Map()
  }

  async addAdapter(track) {
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      track.id,
      track.adapterType.name,
      getConf(track, 'adapter'),
    )
    const refNameMap = new Map()
    const assemblies = getSnapshot(this.assemblies)

    let assemblyName = readConfObject(track.configuration, 'assemblyName')

    if (assemblyName) {
      let refNameAliases = {}
      if (assemblies[assemblyName]) {
        ;({ refNameAliases = {} } = assemblies[assemblyName])
      } else
        Object.keys(assemblies).forEach(assembly => {
          if ((assemblies[assembly].aliases || []).includes(assemblyName)) {
            assemblyName = assembly
            ;({ refNameAliases = {} } = assemblies[assembly])
          }
        })

      const refNames = await dataAdapter.loadData()
      refNames.forEach(refName => {
        refNameMap.set(refName, refName)
        if (refNameAliases[refName])
          refNameAliases[refName].forEach(refNameAlias => {
            refNameMap.set(refNameAlias, refName)
          })
        else
          Object.keys(refNameAliases).forEach(configRefName => {
            if (refNameAliases[configRefName].includes(refName)) {
              refNameMap.set(configRefName, refName)
              refNameAliases[configRefName].forEach(refNameAlias => {
                refNameMap.set(refNameAlias, refName)
              })
            }
          })
      })
    }

    this.adapterMaps.set(
      readConfObject(track.configuration, 'configId'),
      refNameMap,
    )
  }

  getRefNameMap(track) {
    const configId = readConfObject(track.configuration, 'configId')
    if (this.adapterMaps.has(configId)) return this.adapterMaps.get(configId)
    this.addAdapter(track)
    return null
  }

  clear() {
    this.adapterMaps = new Map()
  }
}
