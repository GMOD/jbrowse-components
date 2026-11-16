import {
  HOSTED_HINT,
  HOSTED_LIST_URL,
  fetchJson,
  genomeConfigUrl,
} from '@jbrowse/launch-args'

import type { HostedGenome, Track } from '@jbrowse/launch-args'

export async function hostedGenomes() {
  const { ucscGenomes = {} } = (await fetchJson(
    HOSTED_LIST_URL,
    'the hosted assembly list',
    HOSTED_HINT,
  )) as { ucscGenomes?: Record<string, HostedGenome> }
  return ucscGenomes
}

export async function hostedTracks(genome: string) {
  const { tracks = [] } = (await fetchJson(
    genomeConfigUrl(genome),
    `genome "${genome}"`,
    HOSTED_HINT,
  )) as { tracks?: Track[] }
  return tracks
}
