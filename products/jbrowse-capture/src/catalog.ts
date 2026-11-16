import {
  HOSTED_HINT,
  fetchJson,
  genomeConfigUrl,
  resolveTrackId,
} from '@jbrowse/launch-args'

import { resolveHostedComparative } from './hostedComparative.ts'
import { assemblyFromSession, referencedTrackIds } from './session.ts'
import { assertCoherentOptions, instanceUrl, needsSpec } from './url.ts'

import type { JBrowseUrlOptions } from './url.ts'
import type { Track } from '@jbrowse/launch-args'

interface CatalogAssembly {
  name: string
  aliases?: string[]
}

/** The parts of a JBrowse config.json that name what can be opened. */
export interface Catalog {
  assemblies?: CatalogAssembly[]
  assembly?: CatalogAssembly
  tracks?: Track[]
  connections?: unknown[]
}

interface SpecDeclarations {
  sessionTracks?: Track[]
  sessionConnections?: unknown[]
}

const assembliesOf = (catalog: Catalog) =>
  catalog.assemblies ?? (catalog.assembly ? [catalog.assembly] : [])

/**
 * The canonical name of the assembly `input` names by name or alias, ignoring
 * case: the name the app's census publishes.
 */
const findAssembly = (catalog: Catalog, input: string) => {
  const target = input.toLowerCase()
  return assembliesOf(catalog).find(a =>
    [a.name, ...(a.aliases ?? [])].some(n => n.toLowerCase() === target),
  )
}

export function resolveAssemblyName(catalog: Catalog, input: string) {
  const found = findAssembly(catalog, input)
  if (!found) {
    const names = assembliesOf(catalog)
      .map(a => a.name)
      .join(', ')
    throw new Error(
      `assembly "${input}" is not in the config, which has ${names || 'none'}`,
    )
  }
  return found.name
}

async function fetchCatalog({
  genome,
  config,
  instance,
}: JBrowseUrlOptions): Promise<Catalog | undefined> {
  const url = config
    ? new URL(config, instanceUrl(instance)).href
    : genome
      ? genomeConfigUrl(genome)
      : undefined
  if (!url) {
    return undefined
  }
  const fetched = fetchJson(
    url,
    config ? 'config' : `genome "${genome}"`,
    HOSTED_HINT,
  )
  return (await (config ? fetched.catch(() => undefined) : fetched)) as
    | Catalog
    | undefined
}

/**
 * The options with the assembly and tracks checked against the config and
 * spelled the way it spells them, so a typo fails before a browser launches.
 * A `--config` this cannot fetch passes through for the app to judge, and so
 * does a spec or saved session, which may declare tracks no config lists. A
 * hosted `genome` that fails to fetch throws, since genomes.jbrowse.org either has
 * the assembly or the name is wrong.
 */
export async function resolveAgainstConfig(
  options: JBrowseUrlOptions,
): Promise<JBrowseUrlOptions> {
  if (options.comparative) {
    assertCoherentOptions(options)
    return resolveHostedComparative(options.comparative, options)
  }
  const { genome, assembly, tracks, spec, session } = options
  const wanted = assembly ?? genome
  if (spec || session || (!wanted && !tracks?.length && !needsSpec(options))) {
    return options
  }
  const catalog = await fetchCatalog(options)
  if (!catalog) {
    return options
  }
  const assemblyName = wanted
    ? resolveAssemblyName(catalog, wanted)
    : assembliesOf(catalog)[0]?.name
  const resolve = (id: string) =>
    resolveTrackId(catalog.tracks ?? [], id, assemblyName ?? '')
  return {
    ...options,
    // a session spec names its assembly, where the URL parameters may leave
    // it to the app
    assembly: wanted || needsSpec(options) ? assemblyName : undefined,
    tracks: tracks?.map(t =>
      typeof t === 'string'
        ? resolve(t)
        : { ...t, trackId: resolve(t.trackId) },
    ),
  }
}

function nearMatch(catalog: Catalog, id: string, assemblyName: string) {
  try {
    return ` (did you mean "${resolveTrackId(catalog.tracks ?? [], id, assemblyName)}"?)`
  } catch {
    return ''
  }
}

// a connection brings in tracks no config lists
function assertSpecTracks(
  catalog: Catalog,
  spec: SpecDeclarations,
  assemblyName: string,
) {
  if (!catalog.connections?.length && !spec.sessionConnections?.length) {
    const known = new Set(
      [...(catalog.tracks ?? []), ...(spec.sessionTracks ?? [])].map(
        t => t.trackId,
      ),
    )
    const missing = referencedTrackIds(spec).filter(id => !known.has(id))
    if (missing.length > 0) {
      throw new Error(
        `the session spec opens track(s) neither the config nor its sessionTracks define: ${missing
          .map(id => `"${id}"${nearMatch(catalog, id, assemblyName)}`)
          .join(', ')}`,
      )
    }
  }
}

/**
 * The assembly a spec or saved session opens, spelled the way the config does,
 * since the app's census publishes the config's name and a spec may use an
 * alias. A name the config does not list stays as given: a spec can declare
 * its own assemblies. A spec's tracks are checked against the config too, so
 * a typo fails before a browser launches rather than at the session gate.
 */
export async function sessionAgainstConfig(
  options: JBrowseUrlOptions,
  opens: object,
) {
  const catalog = await fetchCatalog(options)
  const named = assemblyFromSession(opens)
  const assemblyName =
    (named && catalog && findAssembly(catalog, named)?.name) ?? named
  if (catalog && options.spec) {
    assertSpecTracks(catalog, options.spec, assemblyName ?? '')
  }
  return assemblyName
}
