import { getParent, types, Instance, IAnyType } from 'mobx-state-tree'
import AbortablePromiseCache from 'abortable-promise-cache'

// locals
import { getConf, AnyConfigurationModel } from '../configuration'
import {
  BaseOptions,
  BaseRefNameAliasAdapter,
  RegionsAdapter,
} from '../data_adapters/BaseAdapter'
import PluginManager from '../PluginManager'
import { when, Region, Feature } from '../util'
import QuickLRU from '../util/QuickLRU'
import RpcManager from '../rpc/RpcManager'
import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache'

type AdapterConf = Record<string, unknown>

const refNameRegex = new RegExp(
  '[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*',
)

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
  adapterConfig: unknown,
  options: BaseOptions,
  signal?: AbortSignal,
) {
  const { sessionId } = options
  await when(() => !!(assembly.regions && assembly.refNameAliases), {
    signal,
    name: 'when assembly ready',
  })

  const refNames = (await assembly.rpcManager.call(
    sessionId || 'assemblyRpc',
    'CoreGetRefNames',
    {
      adapterConfig,
      signal,
      ...options,
    },
    { timeout: 1000000 },
  )) as string[]

  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  const refNameMap = Object.fromEntries(
    refNames.map(name => {
      checkRefName(name)
      return [assembly.getCanonicalRefName(name), name]
    }),
  )

  // make the reversed map too
  const reversed = Object.fromEntries(
    Object.entries(refNameMap).map(([canonicalName, adapterName]) => [
      adapterName,
      canonicalName,
    ]),
  )

  return {
    forwardMap: refNameMap,
    reverseMap: reversed,
  }
}

// Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
function checkRefName(refName: string) {
  if (!refNameRegex.test(refName)) {
    throw new Error(`Encountered invalid refName: "${refName}"`)
  }
}

type RefNameAliases = Record<string, string | undefined>

interface CacheData {
  adapterConf: unknown
  self: Assembly
  sessionId: string
  options: BaseOptions
}

export interface RefNameMap {
  forwardMap: RefNameAliases
  reverseMap: RefNameAliases
}

export interface BasicRegion {
  start: number
  end: number
  refName: string
  assemblyName: string
}

export interface Loading {
  adapterRegionsWithAssembly: Region[]
  refNameAliases: RefNameAliases
  lowerCaseRefNameAliases: RefNameAliases
  cytobands: Feature[]
}

/**
 * #stateModel Assembly
 */
export default function assemblyFactory(
  assemblyConfigType: IAnyType,
  pm: PluginManager,
) {
  const adapterLoads = new AbortablePromiseCache<CacheData, RefNameMap>({
    cache: new QuickLRU({ maxSize: 1000 }),

    // @ts-expect-error
    async fill(
      args: CacheData,
      signal?: AbortSignal,
      statusCallback?: (arg: string) => void,
    ) {
      const { adapterConf, self, options } = args
      return loadRefNameMap(
        self,
        adapterConf,
        { ...options, statusCallback },
        signal,
      )
    },
  })
  return types
    .model({
      /**
       * #property
       */
      configuration: types.safeReference(assemblyConfigType),
    })
    .volatile(() => ({
      error: undefined as unknown,
      loaded: false,
      loadingP: undefined as Promise<void> | undefined,
      volatileRegions: undefined as BasicRegion[] | undefined,
      refNameAliases: undefined as RefNameAliases | undefined,
      lowerCaseRefNameAliases: undefined as RefNameAliases | undefined,
      cytobands: undefined as Feature[] | undefined,
    }))
    .views(self => ({
      getConf(arg: string) {
        return self.configuration ? getConf(self, arg) : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        // @ts-expect-error
        self.load()
        return !!self.refNameAliases
      },
      /**
       * #getter
       */
      get name(): string {
        return self.getConf('name') || ''
      },
      /**
       * #getter
       */
      get regions() {
        // @ts-expect-error
        self.load()
        return self.volatileRegions
      },
      /**
       * #getter
       */
      get aliases(): string[] {
        return self.getConf('aliases') || []
      },
      /**
       * #getter
       */
      get displayName(): string | undefined {
        return self.getConf('displayName')
      },
      /**
       * #getter
       */
      hasName(name: string) {
        return this.allAliases.includes(name)
      },
      /**
       * #getter
       */
      get allAliases() {
        return [this.name, ...this.aliases]
      },
      /**
       * #getter
       * note: lowerCaseRefNameAliases not included here: this allows the list
       * of refnames to be just the "normal casing", but things like
       * getCanonicalRefName can resolve a lower-case name if needed
       */
      get allRefNames() {
        return !self.refNameAliases
          ? undefined
          : Object.keys(self.refNameAliases)
      },
      /**
       * #getter
       */
      get lowerCaseRefNames() {
        return !self.lowerCaseRefNameAliases
          ? undefined
          : Object.keys(self.lowerCaseRefNameAliases || {})
      },

      /**
       * #getter
       */
      get allRefNamesWithLowerCase() {
        return this.allRefNames && this.lowerCaseRefNames
          ? [...new Set([...this.allRefNames, ...this.lowerCaseRefNames])]
          : undefined
      },
      /**
       * #getter
       */
      get rpcManager(): RpcManager {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self, 2).rpcManager
      },
      /**
       * #getter
       */
      get refNameColors() {
        const colors: string[] = self.getConf('refNameColors') || []
        return colors.length === 0 ? refNameColors : colors
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get refNames() {
        return self.regions?.map(region => region.refName)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getCanonicalRefName(refName: string) {
        if (!self.refNameAliases || !self.lowerCaseRefNameAliases) {
          throw new Error(
            'aliases not loaded, we expect them to be loaded before getCanonicalRefName can be called',
          )
        }
        return (
          self.refNameAliases[refName] || self.lowerCaseRefNameAliases[refName]
        )
      },
      /**
       * #method
       */
      getRefNameColor(refName: string) {
        if (!self.refNames) {
          return undefined
        }
        const idx = self.refNames.indexOf(refName)
        if (idx === -1) {
          return undefined
        }
        return self.refNameColors[idx % self.refNameColors.length]
      },
      /**
       * #method
       */
      isValidRefName(refName: string) {
        if (!self.refNameAliases) {
          throw new Error(
            'isValidRefName cannot be called yet, the assembly has not finished loading',
          )
        }
        return !!this.getCanonicalRefName(refName)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLoaded({
        adapterRegionsWithAssembly,
        refNameAliases,
        lowerCaseRefNameAliases,
        cytobands,
      }: Loading) {
        self.loaded = true
        this.setRegions(adapterRegionsWithAssembly)
        this.setRefNameAliases(refNameAliases, lowerCaseRefNameAliases)
        this.setCytobands(cytobands)
      },
      /**
       * #action
       */
      setError(e: unknown) {
        console.error(e)
        self.error = e
      },
      /**
       * #action
       */
      setRegions(regions: Region[]) {
        self.volatileRegions = regions
      },
      /**
       * #action
       */
      setRefNameAliases(aliases: RefNameAliases, lcAliases: RefNameAliases) {
        self.refNameAliases = aliases
        self.lowerCaseRefNameAliases = lcAliases
      },
      /**
       * #action
       */
      setCytobands(cytobands: Feature[]) {
        self.cytobands = cytobands
      },
      /**
       * #action
       */
      setLoadingP(p?: Promise<void>) {
        self.loadingP = p
      },
      /**
       * #action
       */
      load() {
        if (!self.loadingP) {
          self.loadingP = this.loadPre().catch(e => {
            this.setLoadingP(undefined)
            this.setError(e)
          })
        }
        return self.loadingP
      },
      /**
       * #action
       */
      async loadPre() {
        const conf = self.configuration
        const refNameAliasesAdapterConf = conf?.refNameAliases?.adapter
        const cytobandAdapterConf = conf?.cytobands?.adapter
        const sequenceAdapterConf = conf?.sequence.adapter
        const assemblyName = self.name

        const regions = await getAssemblyRegions(sequenceAdapterConf, pm)
        const adapterRegionsWithAssembly = regions.map(r => {
          checkRefName(r.refName)
          return { ...r, assemblyName }
        })
        const refNameAliases: RefNameAliases = {}

        const ret = await getRefNameAliases(refNameAliasesAdapterConf, pm)
        const cytobands = await getCytobands(cytobandAdapterConf, pm)
        ret.forEach(({ refName, aliases }) => {
          aliases.forEach(a => {
            checkRefName(a)
            refNameAliases[a] = refName
          })
        })
        // add identity to the refNameAliases list
        adapterRegionsWithAssembly.forEach(region => {
          refNameAliases[region.refName] = region.refName
        })

        const lowerCaseRefNameAliases = Object.fromEntries(
          Object.entries(refNameAliases).map(([key, val]) => [
            key.toLowerCase(),
            val,
          ]),
        )

        this.setLoaded({
          adapterRegionsWithAssembly,
          refNameAliases,
          lowerCaseRefNameAliases,
          cytobands,
        })
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getAdapterMapEntry(adapterConf: AdapterConf, options: BaseOptions) {
        const { signal, statusCallback, ...rest } = options
        if (!options.sessionId) {
          throw new Error('sessionId is required')
        }
        return adapterLoads.get(
          adapterConfigCacheKey(adapterConf),
          {
            adapterConf,
            self: self as Assembly,
            options: rest,
          } as CacheData,

          // signal intentionally not passed here, fixes issues like #2221.
          // alternative fix #2540 was proposed but non-working currently
          undefined,
          statusCallback,
        )
      },

      /**
       * #method
       * get Map of `canonical-name -> adapter-specific-name`
       */
      async getRefNameMapForAdapter(
        adapterConf: AdapterConf,
        opts: BaseOptions,
      ) {
        if (!opts?.sessionId) {
          throw new Error('sessionId is required')
        }
        const map = await this.getAdapterMapEntry(adapterConf, opts)
        return map.forwardMap
      },

      /**
       * #method
       * get Map of `adapter-specific-name -> canonical-name`
       */
      async getReverseRefNameMapForAdapter(
        adapterConf: AdapterConf,
        opts: BaseOptions,
      ) {
        const map = await this.getAdapterMapEntry(adapterConf, opts)
        return map.reverseMap
      },
    }))
}

async function getRefNameAliases(
  config: AnyConfigurationModel,
  pm: PluginManager,
  signal?: AbortSignal,
) {
  const type = pm.getAdapterType(config.type)
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pm) as BaseRefNameAliasAdapter
  return adapter.getRefNameAliases({ signal })
}

async function getCytobands(config: AnyConfigurationModel, pm: PluginManager) {
  const type = pm.getAdapterType(config.type)
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pm)

  // @ts-expect-error
  return adapter.getData()
}

async function getAssemblyRegions(
  config: AnyConfigurationModel,
  pm: PluginManager,
  signal?: AbortSignal,
) {
  const type = pm.getAdapterType(config.type)
  const CLASS = await type.getAdapterClass()
  const adapter = new CLASS(config, undefined, pm) as RegionsAdapter
  return adapter.getRegions({ signal })
}

export type AssemblyModel = ReturnType<typeof assemblyFactory>
export type Assembly = Instance<AssemblyModel>
