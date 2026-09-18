import { hubUrl } from './hub.ts'
import { PUBLIC_INSTANCE } from './url.ts'

import type { JBrowseUrlOptions } from './url.ts'

interface CatalogTrack {
  trackId: string
  name?: unknown
}

interface CatalogAssembly {
  name: string
  aliases?: string[]
}

/** The parts of a JBrowse config.json that name what can be opened. */
export interface Catalog {
  assemblies?: CatalogAssembly[]
  assembly?: CatalogAssembly
  tracks?: CatalogTrack[]
}

const CATALOG_FETCH_TIMEOUT_MS = 30000

const trackName = (track: CatalogTrack) =>
  typeof track.name === 'string' ? track.name : ''

const assembliesOf = (catalog: Catalog) =>
  catalog.assemblies ?? (catalog.assembly ? [catalog.assembly] : [])

/**
 * The canonical name of the assembly `input` names by name or alias, ignoring
 * case. The canonical name is the one the app's census publishes, so the
 * session gate compares against it rather than against an alias.
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
 * The trackId `input` names, resolved the way `jb2export --track` resolves one:
 * an exact trackId, then the id with the assembly prefix a hosted config puts
 * on every track (`clinvarMain` for `hg38-clinvarMain`), then a single
 * case-insensitive match on the id, the unprefixed id or the display name. A
 * miss names the tracks whose id or name contains what was typed.
 */
export function resolveTrackId(
  tracks: CatalogTrack[],
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
  const suggestions = tracks
    .filter(t => `${t.trackId} ${trackName(t)}`.toLowerCase().includes(target))
    .slice(0, 8)
    .map(t => t.trackId)
  const hint = suggestions.length
    ? `. Did you mean: ${suggestions.join(', ')}?`
    : ''
  throw new Error(`--track "${input}" is not in the config${hint}`)
}

async function fetchCatalog(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
    })
    return res.ok ? ((await res.json()) as Catalog) : undefined
  } catch {
    return undefined
  }
}

/**
 * The same options with the assembly and tracks checked against the config
 * and spelled the way the config spells them, before any browser launches: a
 * typo fails here with suggestions rather than as a session-gate timeout.
 *
 * A config this cannot fetch or parse passes through unchanged, and the app
 * reports it. A session spec passes through too, since it may declare tracks
 * of its own that no config lists.
 */
export async function resolveAgainstConfig(
  options: JBrowseUrlOptions,
): Promise<JBrowseUrlOptions> {
  const {
    hub,
    config,
    assembly,
    tracks,
    session,
    instance = PUBLIC_INSTANCE,
  } = options
  const wanted = assembly ?? hub
  const url = config
    ? new URL(config, instance).href
    : hub
      ? hubUrl(hub)
      : undefined
  if (session || !url || (!wanted && !tracks?.length)) {
    return options
  }
  const catalog = await fetchCatalog(url)
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
