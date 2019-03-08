import { decorate, observable, values } from 'mobx'
import { readConfObject, getConf } from '../configuration'

export default class AssemblyManager {
  constructor(rpcManager, assemblies) {
    this.rpcManager = rpcManager
    this.assemblies = assemblies
    this.adapterMaps = new Map()
    this.displayedRegions = []
    this.loadDisplayedRegions()
  }

  async getRefNameAliases(assemblyName) {
    const refNameAliases = {}
    let assembly = this.assemblies.get(assemblyName)
    if (!assembly) {
      values(this.assemblies).forEach(otherAssembly => {
        if (
          (readConfObject(otherAssembly, 'aliases') || []).includes(
            assemblyName,
          )
        )
          assembly = otherAssembly
      })
    }

    if (assembly) {
      ;(await this.rpcManager.call(
        assembly.configId,
        'getRefNameAliases',
        {
          sessionId: assemblyName,
          adapterType: readConfObject(assembly, [
            'refNameAliases',
            'adapter',
            'type',
          ]),
          adapterConfig: readConfObject(assembly.refNameAliases, 'adapter'),
        },
        { timeout: 1000000 },
      )).forEach(alias => {
        refNameAliases[alias.refName] = alias.aliases
      })
    }
    return refNameAliases
  }

  async addAdapter(track) {
    const refNameMap = new Map()

    const assemblyName = readConfObject(track.configuration, 'assemblyName')

    if (assemblyName) {
      const refNameAliases = await this.getRefNameAliases(assemblyName)

      const refNames = await this.rpcManager.call(
        track.id,
        'getRefNames',
        {
          sessionId: assemblyName,
          adapterType: readConfObject(track.configuration, ['adapter', 'type']),
          adapterConfig: getConf(track, 'adapter'),
        },
        { timeout: 1000000 },
      )
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

  async loadDisplayedRegions() {
    const regions = []
    const { assemblies, rpcManager } = this
    for (const [assemblyName, assembly] of assemblies) {
      const adapterConfig = readConfObject(assembly.sequence, 'adapter')
      try {
        regions.push(
          // eslint-disable-next-line no-await-in-loop
          ...(await rpcManager.call(
            assembly.configId,
            'getRegions',
            {
              sessionId: assemblyName,
              adapterType: adapterConfig.type,
              adapterConfig,
            },
            { timeout: 1000000 },
          )),
        )
      } catch (error) {
        console.error('Failed to fetch sequence', error)
      }
    }
    this.displayedRegions = regions
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

decorate(AssemblyManager, {
  displayedRegions: observable,
})
