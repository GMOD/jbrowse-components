import { openLocation } from '@jbrowse/core/util/io'

import type { MafAdapterOptions, Sample } from '../types.ts'

/**
 * Build the `sample id` Set used to short-circuit alignment parsing for
 * non-visible samples. All three adapters (BigMaf, MafTabix, BgzipTaffy)
 * apply identical filtering — keep it in one place.
 */
export function buildSampleFilter(
  opts?: MafAdapterOptions,
): Set<string> | undefined {
  return opts?.samples ? new Set(opts.samples.map(s => s.id)) : undefined
}

interface SampleConfigEntry {
  id: string
  label?: string
  color?: string
}

export type SampleConfig = string[] | SampleConfigEntry[]

function isStringArray(r: SampleConfig): r is string[] {
  return typeof r[0] === 'string'
}

export function normalizeSamples(r: SampleConfig): Sample[] {
  return isStringArray(r)
    ? r.map(id => ({ id, label: id }))
    : r.map(s => ({ id: s.id, label: s.label ?? s.id, color: s.color }))
}

export async function getSamplesFromConfig(getConf: (key: string) => unknown) {
  const nhLoc = getConf('nhLocation')
  const isDefaultPath =
    nhLoc &&
    typeof nhLoc === 'object' &&
    'uri' in nhLoc &&
    nhLoc.uri === '/path/to/my.nh'

  const treeNewick = isDefaultPath
    ? undefined
    : await openLocation(nhLoc as Parameters<typeof openLocation>[0]).readFile(
        'utf8',
      )

  return {
    samples: normalizeSamples(getConf('samples') as SampleConfig),
    treeNewick,
  }
}
