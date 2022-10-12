import jsonStableStringify from 'json-stable-stringify'
import { getParent, types, Instance, IAnyType } from 'mobx-state-tree'
import AbortablePromiseCache from 'abortable-promise-cache'

// locals
import { getConf, AnyConfigurationModel } from '../configuration'
import {
  BaseRefNameAliasAdapter,
  RegionsAdapter,
} from '../data_adapters/BaseAdapter'
import PluginManager from '../PluginManager'
import { makeAbortableReaction, when, Region, Feature } from '../util'
import QuickLRU from '../util/QuickLRU'

// Valid refName pattern from https://samtools.github.io/hts-specs/SAMv1.pdf
const refNameRegex = new RegExp(
  '[0-9A-Za-z!#$%&+./:;?@^_|~-][0-9A-Za-z!#$%&*+./:;=?@^_|~-]*',
)

async function loadRefNameMap(
  assembly: Assembly,
  adapterConfig: unknown,
  options: BaseOptions,
  signal?: AbortSignal,
) {
  const { sessionId } = options
  await when(() => Boolean(assembly.regions && assembly.refNameAliases), {
    signal,
    name: 'when assembly ready',
  })

  const refNames = (await assembly.rpcManager.call(
    sessionId,
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

function checkRefName(refName: string) {
  if (!refName.match(refNameRegex)) {
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
export default function assemblyFactory(
  assemblyConfigType: IAnyType,
  pluginManager: PluginManager,
) {
  const adapterLoads = new AbortablePromiseCache<CacheData, RefNameMap>({
    cache: new QuickLRU({ maxSize: 1000 }),
    async fill(
      args: CacheData,
      signal?: AbortSignal,
      statusCallback?: Function,
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
      configuration: types.safeReference(assemblyConfigType),
    })
    .volatile(() => ({
      error: undefined as Error | undefined,
      regions: undefined as BasicRegion[] | undefined,
      refNameAliases: undefined as RefNameAliases | undefined,
      lowerCaseRefNameAliases: undefined as RefNameAliases | undefined,
      cytobands: undefined as Feature[] | undefined,
    }))
    .views(self => ({
      get initialized() {
        return !!self.refNameAliases
      },
      get name(): string {
        return getConf(self, 'name')
      },

      get aliases(): string[] {
        return getConf(self, 'aliases')
      },

      get displayName(): string | undefined {
        return getConf(self, 'displayName')
      },

      hasName(name: string) {
        return this.allAliases.includes(name)
      },

      get allAliases() {
        return [this.name, ...this.aliases]
      },
      get refNames() {
        return self.regions?.map(region => region.refName)
      },

      // note: lowerCaseRefNameAliases not included here: this allows the list
      // of refnames to be just the "normal casing", but things like
      // getCanonicalRefName can resolve a lower-case name if needed
      get allRefNames() {
        return !self.refNameAliases
          ? undefined
          : Object.keys(self.refNameAliases)
      },

      get lowerCaseRefNames() {
        return !self.lowerCaseRefNameAliases
          ? undefined
          : Object.keys(self.lowerCaseRefNameAliases || {})
      },

      get allRefNamesWithLowerCase() {
        return this.allRefNames && this.lowerCaseRefNames
          ? [...new Set([...this.allRefNames, ...this.lowerCaseRefNames])]
          : undefined
      },
      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self, 2).rpcManager
      },
    }))
    .views(self => ({
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
      setLoading() {},
      setLoaded({
        adapterRegionsWithAssembly,
        refNameAliases,
        lowerCaseRefNameAliases,
        cytobands,
      }: {
        adapterRegionsWithAssembly: Region[]
        refNameAliases: RefNameAliases
        lowerCaseRefNameAliases: RefNameAliases
        cytobands: Feature[]
      }) {
        this.setRegions(adapterRegionsWithAssembly)
        this.setRefNameAliases(refNameAliases, lowerCaseRefNameAliases)
        this.setCytobands(cytobands)
      },
      setError(e: Error) {
        console.error(e)
        self.error = e
      },
      setRegions(regions: Region[]) {
        self.regions = regions
      },
      setRefNameAliases(aliases: RefNameAliases, lowerCase: RefNameAliases) {
        self.refNameAliases = aliases
        self.lowerCaseRefNameAliases = lowerCase
      },
      setCytobands(cytobands: Feature[]) {
        self.cytobands = cytobands
      },
      afterAttach() {
        makeAbortableReaction(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self as any,
          // @ts-ignore
          makeLoadAssemblyData(pluginManager),
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

          // signal intentionally not passed here, fixes issues like #2221.
          // alternative fix #2540 was proposed but non-working currently
          undefined,
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

function makeLoadAssemblyData(pluginManager: PluginManager) {
  return (self: Assembly) => {
    if (self.configuration) {
      // use full configuration instead of snapshot of the config, the
      // rpcManager normally receives a snapshot but we bypass rpcManager here
      // to avoid spinning up a webworker
      const { sequence, refNameAliases, cytobands } = self.configuration
      const sequenceAdapterConfig = sequence.adapter
      const refNameAliasesAdapterConfig = refNameAliases?.adapter
      const cytobandAdapterConfig = cytobands?.adapter
      return {
        sequenceAdapterConfig,
        assemblyName: self.name,
        refNameAliasesAdapterConfig,
        cytobandAdapterConfig,
        pluginManager,
      }
    }
    return undefined
  }
}
async function loadAssemblyReaction(
  props: ReturnType<ReturnType<typeof makeLoadAssemblyData>> | undefined,
  signal: AbortSignal,
) {
  if (!props) {
    return
  }

  const {
    sequenceAdapterConfig,
    assemblyName,
    refNameAliasesAdapterConfig,
    cytobandAdapterConfig,
    pluginManager,
  } = props

  const adapterRegions = await getAssemblyRegions(
    sequenceAdapterConfig,
    pluginManager,
    signal,
  )
  const adapterRegionsWithAssembly = adapterRegions.map(adapterRegion => {
    checkRefName(adapterRegion.refName)
    return { ...adapterRegion, assemblyName }
  })
  const refNameAliases: RefNameAliases = {}

  const aliases = await getRefNameAliases(
    refNameAliasesAdapterConfig,
    pluginManager,
    signal,
  )
  const cytobands = await getCytobands(cytobandAdapterConfig, pluginManager)
  aliases.forEach(({ refName, aliases }) => {
    aliases.forEach(alias => {
      checkRefName(alias)
      refNameAliases[alias] = refName
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

  return {
    adapterRegionsWithAssembly,
    refNameAliases,
    lowerCaseRefNameAliases,
    cytobands,
  }
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

  // @ts-ignore
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
