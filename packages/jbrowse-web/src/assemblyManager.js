import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getParent } from 'mobx-state-tree'

export default self => ({
  views: {
    get assemblyData() {
      const assemblyData = new Map()
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
        // eslint-disable-next-line no-loop-func
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
    getRefNameAliases(assemblyName, opts = {}) {
      return Promise.resolve({}).then(refNameAliases => {
        const assemblyConfig = self.assemblyData.get(assemblyName)
        if (assemblyConfig.refNameAliases) {
          return self.rpcManager
            .call(
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
            .then(adapterRefNameAliases => {
              adapterRefNameAliases.forEach(alias => {
                refNameAliases[alias.refName] = alias.aliases
              })
              return refNameAliases
            })
        }
        return refNameAliases
      })
    },

    addRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
      return self.getRefNameAliases(assemblyName, opts).then(refNameAliases => {
        const adapterConfigId = readConfObject(adapterConf, 'configId')
        if (!self.refNameMaps.has(adapterConfigId))
          self.refNameMaps.set(adapterConfigId, new Map())
        const refNameMap = self.refNameMaps.get(adapterConfigId)

        return self.rpcManager
          .call(
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
          .then(refNames => {
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
            return refNameMap
          })
      })
    },

    getRefNameMapForAdapter(adapterConf, assemblyName, opts = {}) {
      const configId = readConfObject(adapterConf, 'configId')
      if (!self.refNameMaps.has(configId))
        return self.addRefNameMapForAdapter(adapterConf, assemblyName, opts)
      return Promise.resolve(self.refNameMaps.get(configId))
    },
  },
})
