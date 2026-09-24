import { fetchJson, hubUrl, trackName, tracksMatching } from './hub.ts'
import { PUBLIC_INSTANCE } from './url.ts'

import type { Track } from './hub.ts'
import type { JBrowseUrlOptions } from './url.ts'

interface CatalogAssembly {
  name: string
  aliases?: string[]
}

/** The parts of a JBrowse config.json that name what can be opened. */
export interface Catalog {
  assemblies?: CatalogAssembly[]
  assembly?: CatalogAssembly
  tracks?: Track[]
}

const assembliesOf = (catalog: Catalog) =>
  catalog.assemblies ?? (catalog.assembly ? [catalog.assembly] : [])

/**
 * The canonical name of the assembly `input` names by name or alias, ignoring
 * case: the name the app's census publishes.
 */
export function resolveAssemblyName(catalog: Catalog, input: string) {
  const assemblies = assembliesOf(catalog)
  const target = input.toLowerCase()
  const found = assemblies.find(a =>
    [a.name, ...(a.aliases ?? [])].some(n => n.toLowerCase() === target),
  )
  if (!found) {
    const names = assemblies.map(a => a.name).join(', ')
    throw new Error(
      `assembly "${input}" is not in the config, which has ${names || 'none'}`,
    )
  }
  return found.name
}

/**
 * The trackId `input` names: an exact trackId, then the id with the assembly
 * prefix a hosted config puts on every track, then a single case-insensitive
 * match on the id, the unprefixed id or the display name. A miss suggests the
 * tracks whose id or name contains the input.
 */
export function resolveTrackId(
  tracks: Track[],
  input: string,
  assemblyName: string,
) {
  const ids = new Set(tracks.map(t => t.trackId))
  const prefixed = `${assemblyName}-${input}`
  if (ids.has(input)) {
    return input
  }
  if (ids.has(prefixed)) {
    return prefixed
  }
  const target = input.toLowerCase()
  const prefix = `${assemblyName}-`.toLowerCase()
  const loose = tracks.filter(t => {
    const id = t.trackId.toLowerCase()
    return (
      id === target ||
      (id.startsWith(prefix) && id.slice(prefix.length) === target) ||
      trackName(t).toLowerCase() === target
    )
  })
  if (loose.length === 1) {
    return loose[0]!.trackId
  }
  if (loose.length > 1) {
    throw new Error(
      `--track "${input}" is ambiguous; matches: ${loose.map(t => t.trackId).join(', ')}`,
    )
  }
  const suggestions = tracksMatching(tracks, input)
    .slice(0, 8)
    .map(t => t.trackId)
  const hint = suggestions.length
    ? `. Did you mean: ${suggestions.join(', ')}?`
    : ''
  throw new Error(`--track "${input}" is not in the config${hint}`)
}

/**
 * The options with the assembly and tracks checked against the config and
 * spelled the way it spells them, so a typo fails before a browser launches.
 * A config this cannot fetch passes through for the app to judge, and so does
 * a spec or saved session, which may declare tracks no config lists.
 */
export async function resolveAgainstConfig(
  options: JBrowseUrlOptions,
): Promise<JBrowseUrlOptions> {
  const {
    hub,
    config,
    assembly,
    tracks,
    spec,
    session,
    instance = PUBLIC_INSTANCE,
  } = options
  const wanted = assembly ?? hub
  const url = config
    ? new URL(config, instance).href
    : hub
      ? hubUrl(hub)
      : undefined
  if (spec || session || !url || (!wanted && !tracks?.length)) {
    return options
  }
  const catalog = (await fetchJson(url, 'config').catch(() => undefined)) as
    | Catalog
    | undefined
  if (!catalog) {
    return options
  }
  const assemblyName = wanted
    ? resolveAssemblyName(catalog, wanted)
    : assembliesOf(catalog)[0]?.name
  return {
    ...options,
    assembly: wanted ? assemblyName : undefined,
    tracks: tracks?.map(t =>
      resolveTrackId(catalog.tracks ?? [], t, assemblyName ?? ''),
    ),
  }
}
