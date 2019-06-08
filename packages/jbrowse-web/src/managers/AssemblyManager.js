import { readConfObject } from '@gmod/jbrowse-core/configuration'

export default class AssemblyManager {
  constructor(rpcManager, rootModel) {
    rpcManager.assemblyManager = this
    this.rpcManager = rpcManager
    this.refNameMaps = new Map()
    this.updateAssemblyData(rootModel)
  }

  updateAssemblyData(rootModel) {
    const rootConfig = rootModel.configuration
    this.assemblyData = new Map()
    for (const assemblyConfig of rootConfig.assemblies) {
      const assemblyName = readConfObject(assemblyConfig, 'assemblyName')
      const assemblyInfo = {}
      if (assemblyConfig.sequence)
        assemblyInfo.sequence = assemblyConfig.sequence
      const refNameAliasesConf = readConfObject(
        assemblyConfig,
        'refNameAliases',
      )
      if (refNameAliasesConf) assemblyInfo.refNameAliases = refNameAliasesConf
      const aliases = readConfObject(assemblyConfig, 'aliases')
      assemblyInfo.aliases = aliases
      this.assemblyData.set(assemblyName, assemblyInfo)
      aliases.forEach((assemblyAlias, idx) => {
        const newAliases = [
          ...aliases.slice(0, idx),
          ...aliases.slice(idx + 1),
          assemblyName,
        ]
        this.assemblyData.set(assemblyAlias, {
          ...assemblyInfo,
          aliases: newAliases,
        })
      })
    }
    rootModel.connections.forEach(connection => {
      connection.assemblies.forEach(assembly => {
        const { assemblyName } = assembly
        if (!this.assemblyData.has(assemblyName)) {
          const assemblyInfo = {}
          assemblyInfo.sequence = assembly.sequence
          assemblyInfo.refNameAliases = assembly.refNameAliases
          this.assemblyData.set(assemblyName, assemblyInfo)
        } else {
          if (
            !this.assemblyData.get(assemblyName).refNameAliases &&
            assembly.refNameAliases
          ) {
            this.assemblyData.get(assemblyName).refNameAliases = readConfObject(
              assembly.refNameAliases,
            )
            this.assemblyData.get(assemblyName).aliases.forEach(alias => {
              this.assemblyData.get(alias).refNameAliases = readConfObject(
                assembly.refNameAliases,
              )
            })
          }
          if (
            (!this.assemblyData.get(assemblyName).sequence &&
              assembly.sequence) ||
            assembly.defaultSequence
          ) {
            this.assemblyData.get(assemblyName).sequence = assembly.sequence

            this.assemblyData.get(assemblyName).aliases.forEach(alias => {
              this.assemblyData.get(alias).sequence = assembly.sequence
            })
          }
        }
      })
    })

    this.setDisplayedRegions(rootModel)
  }

  async setDisplayedRegions(rootModel) {
    for (const view of rootModel.views) {
      const assemblyName = view.displayRegionsFromAssemblyName
      if (assemblyName && this.assemblyData.get(assemblyName).sequence) {
        // eslint-disable-next-line no-await-in-loop
        const displayedRegions = await this.getRegionsForAssembly(assemblyName)
        view.setDisplayedRegions(displayedRegions, true)
      }
    }
  }

  /**
   * Return an object like { refName1: ['alias1', 'alias2'], refName2:
   * ['alias3', 'alias4'] } that describes the reference names and aliases of
   * the given assembly. Returns empty object if the assembly is not found.
   * @param {string} assemblyName The name of an assembly
   * @returns {Promise<object>} Object like { refName1: ['alias1', 'alias2'],
   * refName2: ['alias3', 'alias4'] }
   */
  async getRefNameAliases(assemblyName) {
    const refNameAliases = {}
    const assemblyConfig = this.assemblyData.get(assemblyName)
    if (assemblyConfig.refNameAliases) {
      // eslint-disable-next-line no-await-in-loop
      const adapterRefNameAliases = await this.rpcManager.call(
        assemblyConfig.refNameAliases.adapter.configId,
        'getRefNameAliases',
        {
          sessionId: assemblyName,
          adapterType: assemblyConfig.refNameAliases.adapter.type,
          adapterConfig: assemblyConfig.refNameAliases.adapter,
        },
        { timeout: 1000000 },
      )
      adapterRefNameAliases.forEach(alias => {
        refNameAliases[alias.refName] = alias.aliases
      })
    }
    return refNameAliases
  }

  /**
   * Add a map with entries like (refName alias -> refName used by this adapter)
   * to the `refNameMaps` attribute
   * @param {adapterConf} adapterConf Configuration model of an adapter
   * @param {string} assemblyName Assembly to use for aliasing
   */
  async addRefNameMapForAdapter(adapterConf, assemblyName) {
    const refNameMap = new Map()

    const refNameAliases = await this.getRefNameAliases(assemblyName)

    const refNames = await this.rpcManager.call(
      readConfObject(adapterConf, 'configId'),
      'getRefNames',
      {
        sessionId: assemblyName,
        adapterType: readConfObject(adapterConf, 'type'),
        adapterConfig: adapterConf,
      },
      { timeout: 1000000 },
    )
    refNames.forEach(refName => {
      if (refNameAliases[refName])
        refNameAliases[refName].forEach(refNameAlias => {
          refNameMap.set(refNameAlias, refName)
        })
      else
        Object.keys(refNameAliases).forEach(configRefName => {
          if (refNameAliases[configRefName].includes(refName)) {
            refNameMap.set(configRefName, refName)
            refNameAliases[configRefName].forEach(refNameAlias => {
              if (refNameAlias !== refName)
                refNameMap.set(refNameAlias, refName)
            })
          }
        })
    })

    this.refNameMaps.set(readConfObject(adapterConf, 'configId'), refNameMap)
  }

  /**
   * Return cached refNameMap for the adapter, creating and storing it first if
   * needed
   * @param {adapterConf} adapterConf Configuration model of an adapter
   * @param {string} assemblyName Assembly to use for aliasing
   * @returns {Map} See `addRefNameMapForAdapter` for example Map, or an empty
   * map if the adapter is not found.
   */
  async getRefNameMapForAdapter(adapterConf, assemblyName) {
    const configId = readConfObject(adapterConf, 'configId')
    if (!this.refNameMaps.has(configId))
      await this.addRefNameMapForAdapter(adapterConf, assemblyName)
    return this.refNameMaps.get(configId)
  }

  /**
   * Clear all stored refNameMaps
   */
  clear() {
    this.refNameMaps = new Map()
  }

  async getRegionsForAssembly(assemblyName) {
    const assembly = this.assemblyData.get(assemblyName)
    if (assembly) {
      const adapterConfig = readConfObject(assembly.sequence, 'adapter')
      try {
        // eslint-disable-next-line no-await-in-loop
        const adapterRegions = await this.rpcManager.call(
          assembly.configId,
          'getRegions',
          {
            sessionId: assemblyName,
            adapterType: adapterConfig.type,
            adapterConfig,
          },
          { timeout: 1000000 },
        )
        const adapterRegionsWithAssembly = adapterRegions.map(
          adapterRegion => ({
            ...adapterRegion,
            assemblyName,
          }),
        )
        return adapterRegionsWithAssembly
      } catch (error) {
        console.error('Failed to fetch sequence', error)
      }
    }
    return undefined
  }
}
