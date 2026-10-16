import {
  expandAssemblyShorthand,
  expandSidecarShorthand,
  refNameAliasAdapterType,
} from '@jbrowse/core/assemblyManager/expandAssemblyConfigShorthand'
import { buildRefNameMaps } from '@jbrowse/core/assemblyManager/refNameMaps'
import {
  isRefNameAliasAdapter,
  isRegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * An assembly as a JBrowse config's `assemblies` entry writes it, shorthand
 * included: `{ name, uri, refNameAliases: { uri } }` as well as the full
 * `sequence` and `refNameAliases` adapters.
 */
export type AssemblyConfig = Record<string, unknown>

export interface TablesRegion {
  refName: string
  start: number
  end: number
  originalRefName?: string
}

export interface ResolvedAssembly {
  sequenceAdapter?: Record<string, unknown>
  regions: { refName: string; start: number; end: number }[]
  canonical: (name: string) => string
}

async function adapterOf(
  pluginManager: PluginManager,
  config: Record<string, unknown>,
) {
  return (await getAdapter(pluginManager, 'tables', config)).dataAdapter
}

function aliasAdapterOf(sidecar: unknown) {
  if (sidecar === undefined || sidecar === null) {
    return undefined
  }
  const snap =
    typeof sidecar === 'string'
      ? { uri: sidecar }
      : (sidecar as Record<string, unknown>)
  return expandSidecarShorthand(snap, refNameAliasAdapterType).adapter as
    | Record<string, unknown>
    | undefined
}

async function resolveAssembly(
  pluginManager: PluginManager,
  config: AssemblyConfig,
): Promise<ResolvedAssembly> {
  const expanded = expandAssemblyShorthand(config, pluginManager) as {
    sequence?: { adapter?: Record<string, unknown> }
    refNameAliases?: unknown
  }
  const sequenceAdapter = expanded.sequence?.adapter
  const aliasAdapter = aliasAdapterOf(expanded.refNameAliases)
  const [regions, aliases] = await Promise.all([
    sequenceAdapter
      ? adapterOf(pluginManager, sequenceAdapter).then(a =>
          isRegionsAdapter(a) ? a.getRegions({}) : [],
        )
      : [],
    aliasAdapter
      ? adapterOf(pluginManager, aliasAdapter).then(a =>
          isRefNameAliasAdapter(a) ? a.getRefNameAliases({}) : [],
        )
      : [],
  ])
  const { refNameAliases, lowerCaseRefNameAliases } = buildRefNameMaps(
    regions,
    aliases,
  )
  return {
    sequenceAdapter,
    regions,
    canonical: name =>
      refNameAliases[name] ??
      lowerCaseRefNameAliases[name.toLowerCase()] ??
      name,
  }
}

/** How many resolved assemblies the engine keeps, the most recently read. */
export const RESOLVED_ASSEMBLIES = 16

const resolved = new Map<string, Promise<ResolvedAssembly>>()

export function resolvedAssemblies() {
  return resolved.size
}

export function forgetAssemblies() {
  resolved.clear()
}

/**
 * Resolves assemblies as the browser's assembly does: the sequence adapter
 * config, the contigs it lists, and every name the alias file gives a contig
 * mapped to its canonical name (`buildRefNameMaps`). Every engine shares the
 * {@link RESOLVED_ASSEMBLIES} most recently read.
 */
export function assemblyResolver(pluginManager: PluginManager) {
  return (config: AssemblyConfig) => {
    const key = JSON.stringify(config)
    const assembly = resolved.get(key) ?? resolveAssembly(pluginManager, config)
    resolved.delete(key)
    resolved.set(key, assembly)
    assembly.catch(() => {
      if (resolved.get(key) === assembly) {
        resolved.delete(key)
      }
    })
    for (const oldest of resolved.keys()) {
      if (resolved.size <= RESOLVED_ASSEMBLIES) {
        break
      }
      resolved.delete(oldest)
    }
    return assembly
  }
}

/**
 * Each name as the file behind `adapterConfig` spells its contig: the name
 * itself where the file lists it, else the file's alias of it, as
 * `loadRefNameMap` maps an adapter's names onto the assembly's.
 */
async function spellingIn(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  { canonical }: ResolvedAssembly,
) {
  const adapter = await adapterOf(pluginManager, adapterConfig)
  const names: string[] =
    'getRefNames' in adapter ? await adapter.getRefNames() : []
  const listed = new Set(names)
  const byCanonical = new Map(names.map(n => [canonical(n), n]))
  return (name: string) =>
    listed.has(name) ? name : (byCanonical.get(canonical(name)) ?? name)
}

interface AssemblyArgs {
  adapterConfig?: Record<string, unknown>
  sequenceAdapter?: Record<string, unknown>
  region?: TablesRegion
  regions?: TablesRegion[]
}

/**
 * The args with each region renamed as `renameRegionsIfNeeded` renames a
 * request's: `refName` into the file's spelling and `originalRefName` into
 * the reference's, unless the caller gave it, and the assembly's sequence
 * adapter where the args name none. Args naming no file rename only into the
 * reference's spelling.
 */
export async function renameRegions<A extends AssemblyArgs>(
  pluginManager: PluginManager,
  args: A,
  assembly: ResolvedAssembly,
): Promise<A> {
  const sequenceAdapter = args.sequenceAdapter ?? assembly.sequenceAdapter
  const asIs = (name: string) => name
  const [inFile, inReference] = await Promise.all([
    args.adapterConfig
      ? spellingIn(pluginManager, args.adapterConfig, assembly)
      : asIs,
    sequenceAdapter
      ? spellingIn(pluginManager, sequenceAdapter, assembly)
      : asIs,
  ])
  const rename = (r: TablesRegion) => ({
    ...r,
    refName: inFile(r.refName),
    originalRefName: r.originalRefName ?? inReference(r.refName),
  })
  return {
    ...args,
    ...(sequenceAdapter ? { sequenceAdapter } : {}),
    ...(args.region ? { region: rename(args.region) } : {}),
    ...(args.regions ? { regions: args.regions.map(rename) } : {}),
  }
}
