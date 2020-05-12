import AbortablePromiseCache from 'abortable-promise-cache'
import jsonStableStringify from 'json-stable-stringify'
import { autorun, observable } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  IAnyType,
  SnapshotOrInstance,
  types,
} from 'mobx-state-tree'
import { readConfObject } from './configuration'
import { AnyConfigurationModel } from './configuration/configurationSchema'
import { Region } from './util/types'
import { Region as MSTRegion } from './util/types/mst'
import QuickLRU from './util/QuickLRU'

function checkRefName(refName: string) {
  // Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
  if (
    !refName.match(
      /[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*/,
    )
  ) {
    throw new Error(`Encountered invalid refName: "${refName}"`)
  }
}

export function assemblyFactory(assemblyConfigType: IAnyType) {
  return types
    .model({
      configuration: types.reference(assemblyConfigType),
      regions: types.array(MSTRegion),
      refNameAliases: types.map(types.array(types.string)),
      refNameAliasesSet: false,
    })
    .views(self => ({
      get name(): string {
        return readConfObject(self.configuration, 'name')
      },
      get aliases(): string[] {
        return readConfObject(self.configuration, 'aliases')
      },
      get refNames() {
        return self.regions.map(region => region.refName)
      },
      get ready() {
        return !!self.regions.length && self.refNameAliasesSet
      },
      get allRefNames() {
        const aliases: string[] = []
        self.refNameAliases.forEach(aliasList => {
          aliases.push(...aliasList)
        })
        return [...this.refNames, ...aliases]
      },
      get rpcManager() {
        return getParent(self, 2).rpcManager
      },
      getCanonicalRefName(refName: string) {
        if (this.refNames.includes(refName)) {
          return refName
        }
        for (const [rName, aliases] of self.refNameAliases) {
          if (aliases.includes(refName)) {
            return rName
          }
        }
        return undefined
      },
      isValidRefName(refName: string) {
        return this.allRefNames.includes(refName)
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            const sequenceAdapterConfig = readConfObject(self.configuration, [
              'sequence',
              'adapter',
            ])
            const adapterConfigId = jsonStableStringify(sequenceAdapterConfig)
            const sequenceAborter = new AbortController()
            const { rpcManager } = getParent(self, 2)
            rpcManager
              .call(
                adapterConfigId,
                'getRegions',
                {
                  sessionId: self.name,
                  adapterConfig: sequenceAdapterConfig,
                  signal: sequenceAborter.signal,
                },
                { timeout: 1000000 },
              )
              .then((adapterRegions: Region[]) => {
                const adapterRegionsWithAssembly = adapterRegions.map(
                  adapterRegion => {
                    const { refName } = adapterRegion
                    checkRefName(refName)
                    return {
                      ...adapterRegion,
                      assemblyName: self.name,
                    }
                  },
                )
                this.setRegions(adapterRegionsWithAssembly)
              })
              .catch((error: Error) => {
                getParent(self, 3).setError(String(error))
              })
            if (self.configuration.refNameAliases) {
              const refNameAliasesAdapterConfig = readConfObject(
                self.configuration,
                ['refNameAliases', 'adapter'],
              )
              const refNameAliasesAborter = new AbortController()
              rpcManager
                .call(
                  adapterConfigId,
                  'getRefNameAliases',
                  {
                    sessionId: self.name,
                    adapterConfig: refNameAliasesAdapterConfig,
                    signal: refNameAliasesAborter.signal,
                  },
                  { timeout: 1000000 },
                )
                .then(
                  (
                    refNameAliasesList: {
                      refName: string
                      aliases: string[]
                    }[],
                  ) => {
                    const refNameAliases: Record<string, string[]> = {}
                    refNameAliasesList.forEach(refNameAlias => {
                      refNameAlias.aliases.forEach(alias => {
                        checkRefName(alias)
                      })
                      refNameAliases[refNameAlias.refName] =
                        refNameAlias.aliases
                    })
                    this.setRefNameAliases(refNameAliases)
                    this.setRefNameAliasesSet(true)
                  },
                )
                .catch((error: unknown) => {
                  getParent(self, 3).setError(String(error))
                })
            } else {
              this.setRefNameAliasesSet(true)
            }
          }),
        )
      },
      setRegions(regions: Region[]) {
        self.regions = cast(regions)
      },
      setRefNameAliases(refNameAliases: Record<string, string[]>) {
        self.refNameAliases = cast(refNameAliases)
      },
      setRefNameAliasesSet(isSet: boolean) {
        self.refNameAliasesSet = isSet
      },
    }))
    .actions(self => {
      const refNameMapCache = new AbortablePromiseCache({
        // QuickLRU is a good backing cache to use, but you can use any
        // cache as long as it supports `get`, `set`, `delete`, and `keys`.
        cache: new QuickLRU({ maxSize: 1000 }),

        // the `fill` callback will be called for a cache miss
        async fill(
          { adapterConf }: { adapterConf: unknown },
          signal?: AbortSignal,
        ) {
          const refNameMap = observable.map({})
          if (!self.refNameAliasesSet) {
            return refNameMap
          }
          const stateGroupName = jsonStableStringify(adapterConf)

          const refNames = await self.rpcManager.call(
            stateGroupName,
            'getRefNames',
            {
              sessionId: self.name,
              adapterConfig: adapterConf,
              signal,
            },
            { timeout: 1000000 },
          )
          refNames.forEach((refName: string) => {
            checkRefName(refName)
            const aliases = self.refNameAliases.get(refName)
            if (aliases) {
              aliases.forEach(refNameAlias => {
                refNameMap.set(refNameAlias, refName)
              })
            } else {
              self.refNameAliases.forEach((configAliases, configRefName) => {
                if (configAliases.includes(refName)) {
                  refNameMap.set(configRefName, refName)
                  configAliases.forEach(refNameAlias => {
                    if (refNameAlias !== refName)
                      refNameMap.set(refNameAlias, refName)
                  })
                }
              })
            }
          })
          return refNameMap
        },
      })

      /**
       * get Map of `canonical-name -> adapter-specific-name`
       */
      async function getRefNameMapForAdapter(
        adapterConf: unknown,
        opts: { signal?: AbortSignal } = {},
      ) {
        const adapterConfigId = jsonStableStringify(adapterConf)
        return refNameMapCache.get(
          adapterConfigId,
          { adapterConf },
          opts.signal,
        )
      }

      /**
       * get Map of `adapter-specific-name -> canonical-name`
       */
      async function getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        opts: { signal?: AbortSignal } = {},
      ) {
        const map = await getRefNameMapForAdapter(adapterConf, opts)
        const reversed = new Map()
        for (const [canonicalName, adapterName] of map) {
          reversed.set(adapterName, canonicalName)
        }
        return reversed
      }
      return { getRefNameMapForAdapter, getReverseRefNameMapForAdapter }
    })
}

export default function assemblyManagerFactory(assemblyConfigType: IAnyType) {
  return types
    .model({
      assemblies: types.array(assemblyFactory(assemblyConfigType)),
    })
    .views(self => ({
      get(assemblyName: string) {
        const canonicalName = this.aliasMap.get(assemblyName)
        return self.assemblies.find(
          assembly => assembly.name === (canonicalName || assemblyName),
        )
      },
      get aliasMap() {
        const aliases: Map<string, string> = new Map()
        self.assemblies.forEach(assembly => {
          if (assembly.aliases.length) {
            assembly.aliases.forEach(assemblyAlias => {
              aliases.set(assemblyAlias, assembly.name)
            })
          }
        })
        return aliases
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
      get allPossibleRefNames() {
        const refNames: string[] = []
        self.assemblies.forEach(assembly => {
          refNames.push(...assembly.refNames)
        })
        return refNames
      },
    }))
    .views(self => ({
      async getRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal } = {},
      ) {
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.getRefNameMapForAdapter(adapterConf, opts)
        }
        return observable.map({})
      },
      async getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        assemblyName: string,
        opts: { signal?: AbortSignal } = {},
      ) {
        const assembly = self.get(assemblyName)
        if (assembly) {
          return assembly.getReverseRefNameMapForAdapter(adapterConf, opts)
        }
        return observable.map({})
      },
      isValidRefName(refName: string, assemblyName?: string) {
        if (assemblyName) {
          const assembly = self.get(assemblyName)
          if (assembly) {
            return assembly.isValidRefName(refName)
          }
        }
        return self.allPossibleRefNames.includes(refName)
      },
    }))
    .actions(self => ({
      afterAttach() {
        // self.assemblies.push({
        //   configuration: getParent(self).jbrowse.assemblies[0],
        // })
        addDisposer(
          self,
          autorun(() => {
            getParent(self).jbrowse.assemblies.forEach(
              (assemblyConfig: AnyConfigurationModel) => {
                const existingAssemblyIdx = self.assemblies.findIndex(
                  assembly =>
                    assembly.name === readConfObject(assemblyConfig, 'name'),
                )
                if (existingAssemblyIdx !== -1) {
                  this.replaceAssembly(existingAssemblyIdx, assemblyConfig)
                } else {
                  this.addAssembly(assemblyConfig)
                }
              },
            )
          }),
        )
      },
      addAssembly(
        assemblyConfig: SnapshotOrInstance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies.push({ configuration: assemblyConfig })
      },
      replaceAssembly(
        idx: number,
        assemblyConfig: SnapshotOrInstance<typeof assemblyConfigType> | string,
      ) {
        self.assemblies[idx] = assemblyConfigType.create({
          configuration: assemblyConfig,
        })
      },
    }))
}
