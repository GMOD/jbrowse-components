import jsonStableStringify from 'json-stable-stringify'
import { cast, getParent, IAnyType, types, Instance } from 'mobx-state-tree'
import AbortablePromiseCache from 'abortable-promise-cache'
import { readConfObject } from '../configuration'
import { Region } from '../util/types'
import { Region as MSTRegion } from '../util/types/mst'
import { makeAbortableReaction, when } from '../util'
import QuickLRU from '../util/QuickLRU'

// Based on the UCSC Genome Browser chromosome color palette:
// https://github.com/ucscGenomeBrowser/kent/blob/a50ed53aff81d6fb3e34e6913ce18578292bc24e/src/hg/inc/chromColors.h
// Some colors darkened to have at least a 3:1 contrast ratio on a white
// background
const refNameColors = [
  'rgb(153, 102, 0)',
  'rgb(102, 102, 0)',
  'rgb(153, 153, 30)',
  'rgb(204, 0, 0)',
  'rgb(255, 0, 0)',
  'rgb(255, 0, 204)',
  'rgb(165, 132, 132)', // originally 'rgb(255, 204, 204)'
  'rgb(204, 122, 0)', // originally rgb(255, 153, 0)'
  'rgb(178, 142, 0)', // originally 'rgb(255, 204, 0)'
  'rgb(153, 153, 0)', // originally 'rgb(255, 255, 0)'
  'rgb(122, 153, 0)', // originally 'rgb(204, 255, 0)'
  'rgb(0, 165, 0)', // originally 'rgb(0, 255, 0)'
  'rgb(53, 128, 0)',
  'rgb(0, 0, 204)',
  'rgb(96, 145, 242)', // originally 'rgb(102, 153, 255)'
  'rgb(107, 142, 178)', // originally 'rgb(153, 204, 255)'
  'rgb(0, 165, 165)', // originally 'rgb(0, 255, 255)'
  'rgb(122, 153, 153)', // originally 'rgb(204, 255, 255)'
  'rgb(153, 0, 204)',
  'rgb(204, 51, 255)',
  'rgb(173, 130, 216)', // originally 'rgb(204, 153, 255)'
  'rgb(102, 102, 102)',
  'rgb(145, 145, 145)', // originally 'rgb(153, 153, 153)'
  'rgb(142, 142, 142)', // originally 'rgb(204, 204, 204)'
  'rgb(142, 142, 107)', // originally 'rgb(204, 204, 153)'
  'rgb(96, 163, 48)', // originally 'rgb(121, 204, 61)'
]

async function loadRefNameMap(
  assembly: Assembly,
  adapterConf: unknown,
  options: BaseOptions,
  signal?: AbortSignal,
) {
  const { sessionId } = options
  await when(() => Boolean(assembly.regions && assembly.refNameAliases), {
    signal,
    name: 'when assembly ready',
  })

  const refNames = await assembly.rpcManager.call(
    sessionId,
    'CoreGetRefNames',
    {
      adapterConfig: adapterConf,
      signal,
      ...options,
    },
    { timeout: 1000000 },
  )
  const refNameMap: Record<string, string> = {}
  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  refNames.forEach((refName: string) => {
    checkRefName(refName)
    const canon = assembly.getCanonicalRefName(refName)
    if (canon) {
      refNameMap[canon] = refName
    }
  })

  // make the reversed map too
  const reversed: Record<string, string> = {}
  for (const [canonicalName, adapterName] of Object.entries(refNameMap)) {
    reversed[adapterName] = canonicalName
  }

  return {
    forwardMap: refNameMap,
    reverseMap: reversed,
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

type RefNameAliases = Record<string, string>

export interface BaseOptions {
  signal?: AbortSignal
  sessionId: string
  statusCallback?: Function
}
interface CacheData {
  adapterConf: unknown
  self: Assembly
  sessionId: string
  options: BaseOptions
}
export default function assemblyFactory(assemblyConfigType: IAnyType) {
  const adapterLoads = new AbortablePromiseCache({
    cache: new QuickLRU({ maxSize: 1000 }),
    async fill(
      args: CacheData,
      abortSignal?: AbortSignal,
      statusCallback?: Function,
    ) {
      const { adapterConf, self, options } = args
      return loadRefNameMap(
        self,
        adapterConf,
        { ...options, statusCallback },
        abortSignal,
      )
    },
  })

  return types
    .model({
      configuration: types.safeReference(assemblyConfigType),
      regions: types.maybe(types.array(MSTRegion)),
      refNameAliases: types.maybe(types.map(types.string)),
    })
    .views(self => ({
      get initialized() {
        return Boolean(self.refNameAliases)
      },
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
        if (!self.refNameAliases) {
          return undefined
        }
        return Array.from(self.refNameAliases.keys())
      },
      get pluginManager() {
        return getParent(self, 2).pluginManager
      },
      get rpcManager() {
        return getParent(self, 2).rpcManager
      },
      get refNameColors() {
        const colors = readConfObject(
          self.configuration,
          'refNameColors',
        ) as string[]
        if (colors.length === 0) {
          return refNameColors
        }
        return colors
      },
    }))
    .views(self => ({
      getCanonicalRefName(refName: string) {
        if (!self.refNameAliases) {
          throw new Error(
            'aliases not loaded, we expect them to be loaded before getCanonicalRefName can be called',
          )
        }
        return self.refNameAliases.get(refName)
      },
      getRefNameColor(refName: string) {
        const idx = self.refNames?.findIndex(r => r === refName)
        if (idx === undefined || idx === -1) {
          return undefined
        }
        return self.refNameColors[idx % self.refNameColors.length]
      },
      isValidRefName(refName: string) {
        if (!self.refNameAliases)
          throw new Error(
            'isValidRefName cannot be called yet, the assembly has not finished loading',
          )
        return !!this.getCanonicalRefName(refName)
      },
    }))
    .actions(self => ({
      setLoading() {},
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
        if (!getParent(self, 3).isAssemblyEditing) {
          getParent(self, 3).setError(error)
        }
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
          // @ts-ignore
          loadAssemblyData,
          loadAssemblyReaction,
          { name: `${self.name} assembly loading`, fireImmediately: true },
          this.setLoading,
          this.setLoaded,
          this.setError,
        )
      },
    }))
    .views(self => ({
      getAdapterMapEntry(adapterConf: unknown, options: BaseOptions) {
        const { signal, statusCallback, ...rest } = options
        if (!options.sessionId) {
          throw new Error('sessionId is required')
        }
        const adapterId = getAdapterId(adapterConf)
        return adapterLoads.get(
          adapterId,
          {
            adapterConf,
            self: self as Assembly,
            options: rest,
          } as CacheData,
          signal,
          statusCallback,
        )
      },

      /**
       * get Map of `canonical-name -> adapter-specific-name`
       */
      async getRefNameMapForAdapter(adapterConf: unknown, opts: BaseOptions) {
        if (!opts || !opts.sessionId) {
          throw new Error('sessionId is required')
        }
        const map = await this.getAdapterMapEntry(adapterConf, opts)
        return map.forwardMap
      },

      /**
       * get Map of `adapter-specific-name -> canonical-name`
       */
      async getReverseRefNameMapForAdapter(
        adapterConf: unknown,
        opts: BaseOptions,
      ) {
        const map = await this.getAdapterMapEntry(adapterConf, opts)
        return map.reverseMap
      },
    }))
}
function loadAssemblyData(self: Assembly) {
  if (self.configuration) {
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
      assembly: self,
      assemblyName: self.name,
      refNameAliasesAdapterConfig,
    }
  }
  return undefined
}
async function loadAssemblyReaction(
  props: ReturnType<typeof loadAssemblyData> | undefined,
  _signal: AbortSignal,
) {
  if (!props) {
    return
  }

  const {
    sequenceAdapterConfig,
    assemblyName,
    assembly,
    refNameAliasesAdapterConfig,
  } = props

  const { pluginManager } = assembly
  const dataAdapterType = pluginManager.getAdapterType(
    sequenceAdapterConfig.type,
  )
  const adapter = new dataAdapterType.AdapterClass(sequenceAdapterConfig)
  const adapterRegions = (await adapter.getRegions()) as Region[]

  const adapterRegionsWithAssembly = adapterRegions.map(adapterRegion => {
    const { refName } = adapterRegion
    checkRefName(refName)
    return { ...adapterRegion, assemblyName }
  })
  const refNameAliases: RefNameAliases = {}
  if (refNameAliasesAdapterConfig) {
    const refAliasAdapterType = pluginManager.getAdapterType(
      refNameAliasesAdapterConfig.type,
    )
    const refNameAliasAdapter = new refAliasAdapterType.AdapterClass(
      refNameAliasesAdapterConfig,
    )
    const refNameAliasesList = (await refNameAliasAdapter.getRefNameAliases()) as {
      refName: string
      aliases: string[]
    }[]

    refNameAliasesList.forEach(({ refName, aliases }) => {
      aliases.forEach(alias => {
        checkRefName(alias)
        refNameAliases[alias] = refName
      })
    })
  }

  // add identity to the refNameAliases list
  adapterRegionsWithAssembly.forEach(region => {
    refNameAliases[region.refName] = region.refName
  })
  // eslint-disable-next-line consistent-return
  return { adapterRegionsWithAssembly, refNameAliases }
}
export type Assembly = Instance<ReturnType<typeof assemblyFactory>>
