import type { ComparativeRow } from './comparative.ts'
import type { Track } from './fileInput.ts'

// No `node:` imports here: JBrowse Desktop's renderer fetches the hosted
// configs and calls this through the `@jbrowse/launch-args/hostedGenomes`
// subpath.

type NamedAssembly = { name: string } & Record<string, unknown>

export interface TextSearchAdapter {
  type: string
  assemblyNames?: string[]
  [key: string]: unknown
}

/**
 * The parts of a genomes.jbrowse.org config.json a comparative view reads, with
 * the assembly type the caller holds them as.
 */
export interface HostedConfig<A extends { name: string } = NamedAssembly> {
  assemblies?: A[]
  tracks?: Track[]
  aggregateTextSearchAdapters?: TextSearchAdapter[]
}

// order-free, as a track's [query, target] follows its file format; a self
// pair names the assembly twice
function compares(track: Track, a: string, b: string) {
  const names = track.assemblyNames ?? []
  return a === b
    ? names.filter(name => name === a).length >= 2
    : names.includes(a) && names.includes(b)
}

/**
 * What a comparative view's `--genome` rows take from their hosted configs,
 * keyed by genome name: each genome's assembly, its gene-name search, so a row's
 * `loc:` can name a gene, and a comparison for each gap beside a hosted row
 * that no comparison file fills.
 *
 * A config holds the comparisons its genome is the target of, so a pair is
 * often hosted twice, once in each direction; the upper row's config wins, and
 * the gap draws one comparison. A gap neither config covers throws.
 */
export function hostedComparative<A extends { name: string }>(
  rows: ComparativeRow[],
  fileTracks: Track[],
  configs: ReadonlyMap<string, HostedConfig<A>>,
) {
  const assemblies = [...configs].map(([name, config]) => {
    const assembly = config.assemblies?.find(a => a.name === name)
    if (!assembly) {
      throw new Error(
        `--genome ${name}: its hosted config names no assembly ${name}`,
      )
    }
    return assembly
  })
  const textSearchAdapters = [...configs].flatMap(([name, config]) =>
    (config.aggregateTextSearchAdapters ?? []).filter(adapter =>
      adapter.assemblyNames?.includes(name),
    ),
  )
  const tracks: Track[] = []
  for (const [i, lower] of rows.slice(1).entries()) {
    const a = rows[i]!.assembly
    const b = lower.assembly
    const sources = [configs.get(a), configs.get(b)].filter(c => !!c)
    if (
      sources.length &&
      ![...fileTracks, ...tracks].some(track => compares(track, a, b))
    ) {
      const hosted = sources
        .flatMap(config => config.tracks ?? [])
        .find(track => track.type === 'SyntenyTrack' && compares(track, a, b))
      if (!hosted) {
        throw new Error(
          `genomes.jbrowse.org has no comparison between ${a} and ${b}; put a comparison file between them`,
        )
      }
      tracks.push(hosted)
    }
  }
  return { assemblies, textSearchAdapters, tracks }
}
