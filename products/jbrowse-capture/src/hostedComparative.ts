import { genomeConfigUrl } from '@jbrowse/launch-args'
import { hostedComparative } from '@jbrowse/launch-args/hostedGenomes'

import { fetchJson } from './genome.ts'

import type { JBrowseUrlOptions } from './url.ts'
import type { ComparativeRow } from '@jbrowse/launch-args'
import type { HostedConfig } from '@jbrowse/launch-args/hostedGenomes'

/** A synteny view or dotplot of genomes.jbrowse.org genomes, one row each. */
export interface HostedComparative {
  type: 'LinearSyntenyView' | 'DotplotView'
  rows: ComparativeRow[]
  /** each row's genome once */
  hosted: string[]
}

// A location relative to the config that names it, as `liftOver/x.pif.gz` is,
// resolves against `baseUri`; written into the page's session it would
// otherwise resolve against the page's own config, another genome's.
function stampBaseUri(value: unknown, baseUri: string) {
  if (Array.isArray(value)) {
    for (const item of value) {
      stampBaseUri(item, baseUri)
    }
  } else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if (typeof record.uri === 'string' && record.baseUri === undefined) {
      record.baseUri = baseUri
    }
    for (const child of Object.values(record)) {
      stampBaseUri(child, baseUri)
    }
  }
}

// The page reads one config, so another genome's gene-name search reaches it
// only on a track: the app also searches each session track's own index, and
// one of the genome's feature tracks carries it, unopened.
function searchCarrier(name: string, config: HostedConfig) {
  const textSearchAdapter = config.aggregateTextSearchAdapters?.find(a =>
    a.assemblyNames?.includes(name),
  )
  const track = config.tracks?.find(
    t => t.type === 'FeatureTrack' && t.assemblyNames?.includes(name),
  )
  return textSearchAdapter && track
    ? [{ ...track, textSearching: { textSearchAdapter } }]
    : []
}

async function fetchHosted(name: string) {
  const url = genomeConfigUrl(name)
  const config = await fetchJson(url, `genome "${name}"`)
  stampBaseUri(config, url)
  return [name, config as HostedConfig] as const
}

/**
 * The page a hosted comparative view opens: the top row's genome as the
 * page's config, and a session spec adding the other genomes, their gene-name
 * search and each comparison that config lacks.
 */
export async function resolveHostedComparative(
  { type, rows, hosted }: HostedComparative,
  options: JBrowseUrlOptions,
): Promise<JBrowseUrlOptions> {
  const configs = new Map(await Promise.all(hosted.map(fetchHosted)))
  const { assemblies, tracks } = hostedComparative(rows, [], configs)
  const base = rows[0]!.assembly
  const baseTrackIds = new Set(
    (configs.get(base)?.tracks ?? []).map(t => t.trackId),
  )
  const { comparative: _, view, ...rest } = options
  return {
    ...rest,
    genome: base,
    spec: {
      sessionAssemblies: assemblies.filter(a => a.name !== base),
      sessionTracks: [
        ...tracks.filter(t => !baseTrackIds.has(t.trackId)),
        ...[...configs]
          .filter(([name]) => name !== base)
          .flatMap(([name, config]) => searchCarrier(name, config)),
      ],
      views: [
        {
          ...view,
          type,
          views: rows,
          tracks: tracks.map(t => t.trackId),
        },
      ],
    },
  }
}
