import jsonStableStringify from 'json-stable-stringify'
import {
  cast,
  getParent,
  IAnyType,
  types,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'
import AbortablePromiseCache from 'abortable-promise-cache'
import { readConfObject } from '../configuration'
import { Region } from '../util/types'
import { Region as MSTRegion } from '../util/types/mst'
import { makeAbortableReaction, isAbortException, when } from '../util'
import QuickLRU from '../util/QuickLRU'

const refNameAdapterMapSet = types.model('RefNameMappingForAdapter', {
  forwardMap: types.map(types.string),
  reverseMap: types.map(types.string),
})

async function loadRefNameMap(
  assembly: Assembly,
  adapterId: string,
  adapterConf: unknown,
  sessionId = `assemblyManager-${assembly.name}`,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await when(() => Boolean(assembly.regions && assembly.refNameAliases), {
      timeout: 20000,
      signal,
      name: 'when assembly ready',
    })

    let refNames = []
    try {
      refNames = await assembly.rpcManager.call(
        sessionId,
        'CoreGetRefNames',
        {
          sessionId,
          adapterConfig: adapterConf,
          signal,
        },
        { timeout: 1000000 },
      )
    } catch (error) {
      if (!isAbortException) {
        console.error(
          `Error loading adapter refNames for adapter ${getAdapterId(
            adapterConf,
          )}`,
        )
      }
    }

    const refNameMap: Record<string, string> = {}
    const { refNameAliases } = assembly
    if (!refNameAliases) {
      throw new Error(
        `error loading assembly ${assembly.name}'s refNameAliases`,
      )
    }

    refNames.forEach((refName: string) => {
      checkRefName(refName)
      const aliases = refNameAliases.get(refName)
      if (aliases) {
        aliases.forEach(refNameAlias => {
          refNameMap[refNameAlias] = refName
        })
      } else {
        refNameAliases.forEach((configAliases, configRefName) => {
          if (configAliases.includes(refName)) {
            refNameMap[configRefName] = refName
            configAliases.forEach(refNameAlias => {
              if (refNameAlias !== refName) refNameMap[refNameAlias] = refName
            })
          }
        })
      }
    })

    // make the reversed map too
    const reversed: Record<string, string> = {}
    for (const [canonicalName, adapterName] of Object.entries(refNameMap)) {
      reversed[adapterName] = canonicalName
    }

    assembly.addAdapterMap(adapterId, {
      forwardMap: refNameMap,
      reverseMap: reversed,
    })
  } catch (err) {
    if (isAbortException(err)) {
      assembly.addAdapterMap(adapterId, {
        forwardMap: {},
        reverseMap: {},
      })
    } else {
      console.error(err)
      throw err
    }
  }
}

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

function getAdapterId(adapterConf: unknown) {
  return jsonStableStringify(adapterConf)
}

type RefNameAliases = Record<string, string[]>

export default function assemblyFactory(assemblyConfigType: IAnyType) {
  interface CacheData {
    adapterConf: unknown
    adapterId: string
    self: Assembly
    sessionId?: string
  }
  const adapterLoadsInFlight = new AbortablePromiseCache<CacheData, void>({
    cache: new QuickLRU({ maxSize: 1000 }),
    async fill(
      { adapterConf, adapterId, self, sessionId }: CacheData,
      abortSignal?: AbortSignal,
    ) {
      return loadRefNameMap(
        self,
        adapterId,
        adapterConf,
        sessionId,
        abortSignal,
      )
    },
  })

  return types
    .model({
      configuration: types.reference(assemblyConfigType),
      regions: types.maybe(types.array(MSTRegion)),
      refNameAliases: types.maybe(types.map(types.array(types.string))),
      adapterMaps: types.map(refNameAdapterMapSet), // map of adapter ID => refNameAdapterMap
    })
    .views(self => ({
      get name(): string {
        return readConfObject(self.configuration, 'name')
      },
      get aliases(): string[] {
        return readConfObject(self.configuration, 'aliases')
      },
      get refNames() {
        return self.regions && self.regions.map(region => region.refName)
      },
      get allRefNames() {
        if (!(this.refNames && self.refNameAliases)) {
          return undefined
        }
        let aliases: string[] = []
        self.refNameAliases.forEach(aliasList => {
          aliases = aliases.concat(aliasList)
        })
        return [...this.refNames, ...aliases]
      },
      get rpcManager() {
        return getParent(self, 2).rpcManager
      },
      getCanonicalRefName(refName: string) {
        if (!this.refNames || !self.refNameAliases) {
          throw new Error(
            'assembly not loaded, getCanonicalRefName should not be used until the assembly is loaded',
          )
        }
        if (this.refNames.includes(refName)) {
          return refName
        }
        for (const [rName, aliases] of self.refNameAliases) {
          if (aliases.includes(refName)) {
            return rName
          }
        }
        throw new Error(
          `unknown reference sequence name ${refName}, this reference does not appear in the assembly`,
        )
      },
      isValidRefName(refName: string) {
        if (!this.allRefNames)
          throw new Error(
            'isValidRefName cannot be called yet, the assembly has not finished loading',
          )
        return this.allRefNames.includes(refName)
      },
    }))
    .actions(self => ({
      setLoading(abortController: AbortController) {},
      setLoaded({
        adapterRegionsWithAssembly,
        refNameAliases,
      }: {
        adapterRegionsWithAssembly: Region[]
        refNameAliases: RefNameAliases
      }) {
        this.setRegions(adapterRegionsWithAssembly)
        this.setRefNameAliases(refNameAliases)
      },
      setError(error: Error) {
        getParent(self, 3).setError(String(error))
      },
      setRegions(regions: Region[]) {
        self.regions = cast(regions)
      },
      setRefNameAliases(refNameAliases: RefNameAliases) {
        self.refNameAliases = cast(refNameAliases)
      },
      afterAttach() {
        makeAbortableReaction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self as any,
          loadAssemblyData,
          loadAssemblyReaction,
          { name: `${self.name} assembly loading`, fireImmediately: true },
          this.setLoading,
          this.setLoaded,
          this.setError,
        )
      },
      addAdapterMap(
        adapterId: string,
        snap: SnapshotIn<typeof refNameAdapterMapSet>,
      ) {
        self.adapterMaps.set(adapterId, snap)
      },
    }))
    .views(self => ({
      getAdapterMapEntry(
        adapterConf: unknown,
        opts: { signal?: AbortSignal; sessionId?: string } = {},
      ) {
        const adapterId = getAdapterId(adapterConf)
        const adapterMap = self.adapterMaps.get(adapterId)
        if (!adapterMap) {
          adapterLoadsInFlight
            .get(
              adapterId,
              {
                adapterConf,
                adapterId,
                self: self as Assembly,
                sessionId: opts.sessionId,
              },
              opts.signal,
            )
            .catch(err => {
              if (!isAbortException(err)) console.error(err)
            })
          return undefined
        }
        return adapterMap
      },

      /**
       * get Map of `canonical-name -> adapter-specific-name`
       */
      getRefNameMapForAdapter(
        adapterConf: unknown,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        return this.getAdapterMapEntry(adapterConf, opts)?.forwardMap
      },

      /**
       * get Map of `adapter-specific-name -> canonical-name`
       */
      getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        return this.getAdapterMapEntry(adapterConf, opts)?.reverseMap
      },
    }))
}
function loadAssemblyData(self: Assembly) {
  const sequenceAdapterConfig = readConfObject(self.configuration, [
    'sequence',
    'adapter',
  ])
  const adapterConfigId = getAdapterId(sequenceAdapterConfig)
  const { rpcManager } = getParent(self, 2)
  const refNameAliasesAdapterConfig =
    self.configuration.refNameAliases &&
    readConfObject(self.configuration, ['refNameAliases', 'adapter'])
  return {
    sequenceAdapterConfig,
    adapterConfigId,
    rpcManager,
    assemblyName: self.name,
    refNameAliasesAdapterConfig,
  }
}
async function loadAssemblyReaction(
  props: ReturnType<typeof loadAssemblyData> | undefined,
  signal: AbortSignal,
) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const {
    sequenceAdapterConfig,
    rpcManager,
    assemblyName,
    refNameAliasesAdapterConfig,
  } = props

  const sessionId = `assembly-${assemblyName}`
  const adapterRegions = (await rpcManager.call(
    sessionId,
    'CoreGetRegions',
    { sessionId, adapterConfig: sequenceAdapterConfig, signal },
    { timeout: 1000000 },
  )) as Region[]
  const adapterRegionsWithAssembly = adapterRegions.map(adapterRegion => {
    const { refName } = adapterRegion
    checkRefName(refName)
    return { ...adapterRegion, assemblyName }
  })
  const refNameAliases: RefNameAliases = {}
  if (refNameAliasesAdapterConfig) {
    const refNameAliasesAborter = new AbortController()
    const refNameAliasesList = (await rpcManager.call(
      sessionId,
      'CoreGetRefNameAliases',
      {
        sessionId,
        adapterConfig: refNameAliasesAdapterConfig,
        signal: refNameAliasesAborter.signal,
      },
      { timeout: 1000000 },
    )) as {
      refName: string
      aliases: string[]
    }[]

    refNameAliasesList.forEach(refNameAlias => {
      refNameAlias.aliases.forEach(alias => {
        checkRefName(alias)
      })
      refNameAliases[refNameAlias.refName] = refNameAlias.aliases
    })
  }
  return { adapterRegionsWithAssembly, refNameAliases }
}
export type Assembly = Instance<ReturnType<typeof assemblyFactory>>
