import { openLocation } from '@jbrowse/core/util/io'

import type { Sample } from '../types.ts'

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
