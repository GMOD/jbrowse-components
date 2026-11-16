import {
  HOSTED_LIST_URL,
  formatHostedGenomes,
  formatHostedTracks,
} from '@jbrowse/launch-args'

import { fetchJson, resolveConfigObject } from './resolveHub.ts'

import type { HostedGenome } from '@jbrowse/launch-args'

const LISTING = { command: 'jb2export', out: 'out.svg' }

export async function runList([genome, filter]: string[]) {
  if (genome) {
    const config = await resolveConfigObject({ genome })
    const { text, matched } = formatHostedTracks(
      genome,
      config?.tracks ?? [],
      filter,
      LISTING,
    )
    if (matched === 0) {
      process.exitCode = 1
    }
    return text
  }
  const data = (await fetchJson(
    HOSTED_LIST_URL,
    'Failed to fetch assembly list',
  )) as { ucscGenomes?: Record<string, HostedGenome> }
  return formatHostedGenomes(data.ucscGenomes ?? {}, LISTING)
}
