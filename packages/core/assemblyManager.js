import { observable } from 'mobx'
import { getParent } from 'mobx-state-tree'
import { readConfObject } from './configuration'

export default self => ({
  views: {
    async getCanonicalRefName(refName, assemblyName) {
      const refNameAliases = await self.getRefNameAliases(assemblyName)
      const aliasesToCanonical = {}
      Object.entries(refNameAliases).forEach(([ref, aliases]) => {
        aliases.forEach(alias => {
          aliasesToCanonical[alias] = ref
        })
      })
      return aliasesToCanonical[refName]
    },
    get assemblyData() {
      const assemblyData = observable.map({})
      for (const datasetConfig of self.datasets) {
        const assemblyConfig = datasetConfig.assembly
        const assemblyName = readConfObject(assemblyConfig, 'name')
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
        assemblyData.set(assemblyName, assemblyInfo)
        aliases.forEach((assemblyAlias, idx) => {
          const newAliases = [
            ...aliases.slice(0, idx),
            ...aliases.slice(idx + 1),
            assemblyName,
          ]
          assemblyData.set(assemblyAlias, {
            ...assemblyInfo,
            aliases: newAliases,
          })
        })
      }
      for (const assemblyName of getParent(self).session.connections.keys()) {
        const connectionConfs = getParent(self).session.connections.get(
          assemblyName,
        )
        connectionConfs.forEach(connectionConf => {
          if (!assemblyData.has(assemblyName)) {
            const assemblyInfo = {}
            assemblyInfo.sequence = connectionConf.sequence
            assemblyInfo.refNameAliases = connectionConf.refNameAliases
            assemblyData.set(assemblyName, assemblyInfo)
          } else {
            if (
              !assemblyData.get(assemblyName).refNameAliases &&
              connectionConf.refNameAliases
            ) {
              assemblyData.get(assemblyName).refNameAliases = readConfObject(
                connectionConf.refNameAliases,
              )
              assemblyData.get(assemblyName).aliases.forEach(alias => {
                assemblyData.get(alias).refNameAliases = readConfObject(
                  connectionConf.refNameAliases,
                )
              })
            }
            if (
              (!assemblyData.get(assemblyName).sequence &&
                connectionConf.sequence) ||
              connectionConf.defaultSequence
            ) {
              assemblyData.get(assemblyName).sequence = connectionConf.sequence
              assemblyData.get(assemblyName).aliases.forEach(alias => {
                assemblyData.get(alias).sequence = connectionConf.sequence
              })
            }
          }
        })
      }
      return assemblyData
    },
  },
  actions: {
    async getRefNameAliases(assemblyName, opts = {}) {
      const refNameAliases = {}
      const assemblyConfig = self.assemblyData.get(assemblyName)
      if (assemblyConfig.refNameAliases) {
        const adapterRefNameAliases = await self.rpcManager.call(
          assemblyConfig.refNameAliases.adapter.configId,
          'getRefNameAliases',
          {
            sessionId: assemblyName,
            adapterType: assemblyConfig.refNameAliases.adapter.type,
            adapterConfig: assemblyConfig.refNameAliases.adapter,
            signal: opts.signal,
          },
          { timeout: 1000000 },
        )
        adapterRefNameAliases.forEach(alias => {
          refNameAliases[alias.refName] = alias.aliases
        })
      }
      return refNameAliases
    },

    /**
     * gets the list of reference sequence names from the adapter in question, and
     * uses those to build a Map of adapter_ref_name -> canonical_ref_name
     */
    async addRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
      const refNameAliases = await self.getRefNameAliases(assemblyName, opts)
      const adapterConfigId = readConfObject(adapterConf, 'configId')
      const refNameMap = observable.map({})

      const refNames = await self.rpcManager.call(
        readConfObject(adapterConf, 'configId'),
        'getRefNames',
        {
          sessionId: assemblyName,
          adapterType: readConfObject(adapterConf, 'type'),
          adapterConfig: adapterConf,
          signal: opts.signal,
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
      self.refNameMaps.set(adapterConfigId, refNameMap)
      return refNameMap
    },

    async getRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
      const configId = readConfObject(adapterConf, 'configId')
      if (!self.refNameMaps.has(configId)) {
        return self.addRefNameMapForAdapter(adapterConf, assemblyName, opts)
      }
      return self.refNameMaps.get(configId)
    },
  },
})
