import { HOSTED_LIST_URL, genomeConfigUrl } from '@jbrowse/launch-args'

import type { HostedGenome, Track } from '@jbrowse/launch-args'

const FETCH_TIMEOUT_MS = 30000

const BROWSE_HINT =
  'See https://genomes.jbrowse.org for the available assemblies.'

/** Fetch JSON with a timeout, throwing a message that names `what` and the URL. */
export async function fetchJson(url: string, what: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(
      `${what} could not be fetched from ${url} ` +
        `(${error instanceof Error ? error.message : error}${
          timedOut ? `, after ${FETCH_TIMEOUT_MS}ms` : ''
        }). ${BROWSE_HINT}`,
    )
  })
  if (!res.ok) {
    throw new Error(
      `${what} not found (HTTP ${res.status} from ${url}). ${BROWSE_HINT}`,
    )
  }
  return res.json()
}

export async function hostedGenomes() {
  const { ucscGenomes = {} } = (await fetchJson(
    HOSTED_LIST_URL,
    'the hosted assembly list',
  )) as { ucscGenomes?: Record<string, HostedGenome> }
  return ucscGenomes
}

export async function hostedTracks(genome: string) {
  const { tracks = [] } = (await fetchJson(
    genomeConfigUrl(genome),
    `genome "${genome}"`,
  )) as { tracks?: Track[] }
  return tracks
}
