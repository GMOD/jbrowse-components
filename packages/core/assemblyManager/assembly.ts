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
  adapterId: string,
  adapterConf: unknown,
  sessionId: string,
  signal?: AbortSignal,
) {
  await when(() => Boolean(assembly.regions && assembly.refNameAliases), {
    signal,
    name: 'when assembly ready',
  })

  const refNames = await assembly.rpcManager.call(
    sessionId,
    'CoreGetRefNames',
    {
      sessionId,
      adapterConfig: adapterConf,
      signal,
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

type RefNameAliases = Record<string, string[]>

export default function assemblyFactory(assemblyConfigType: IAnyType) {
  interface CacheData {
    adapterConf: unknown
    adapterId: string
    self: Assembly
    sessionId: string
  }
  const adapterLoads = new AbortablePromiseCache({
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
        if (!self.refNames || !self.refNameAliases) {
          throw new Error(
            'assembly not loaded, getCanonicalRefName should not be used until the assembly is loaded',
          )
        }
        if (self.refNames.includes(refName)) {
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
      getRefNameColor(refName: string) {
        const idx = self.refNames?.findIndex(r => r === refName)
        if (idx === undefined || idx === -1) {
          return undefined
        }
        return self.refNameColors[idx % self.refNameColors.length]
      },
      isValidRefName(refName: string) {
        if (!self.allRefNames)
          throw new Error(
            'isValidRefName cannot be called yet, the assembly has not finished loading',
          )
        return self.allRefNames.includes(refName)
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
    }))
    .views(self => ({
      getAdapterMapEntry(
        adapterConf: unknown,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        const { signal, ...rest } = opts
        if (!opts.sessionId) {
          throw new Error('sessionId is required')
        }
        const adapterId = getAdapterId(adapterConf)
        return adapterLoads.get(
          adapterId,
          {
            adapterConf,
            adapterId,
            self: self as Assembly,
            ...rest,
          },
          signal,
        )
      },

      /**
       * get Map of `canonical-name -> adapter-specific-name`
       */
      async getRefNameMapForAdapter(
        adapterConf: unknown,
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
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
        opts: { signal?: AbortSignal; sessionId: string },
      ) {
        const map = await this.getAdapterMapEntry(adapterConf, opts)
        return map.reverseMap
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
