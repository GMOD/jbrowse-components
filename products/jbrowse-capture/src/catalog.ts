import { genomeConfigUrl, resolveTrackId } from '@jbrowse/launch-args'

import { fetchJson } from './genome.ts'
import { resolveHostedComparative } from './hostedComparative.ts'
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
  const fetched = fetchJson(url, config ? 'config' : `genome "${genome}"`)
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

/**
 * The assembly a spec or saved session names, spelled the way the config does,
 * since the app's census publishes the config's name and a spec may use an
 * alias. A name the config does not list stays as given: a spec can declare
 * its own assemblies.
 */
export async function canonicalSessionAssembly(
  options: JBrowseUrlOptions,
  name: string,
) {
  const catalog = await fetchCatalog(options)
  return (catalog && findAssembly(catalog, name)?.name) ?? name
}
