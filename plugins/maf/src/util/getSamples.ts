import { openLocation } from '@jbrowse/core/util/io'
import { parseNewick } from '@jbrowse/tree-sidebar'

import { normalize } from '../util.ts'

type SampleConfig = string[] | { id: string; label?: string; color?: string }[]

export async function getSamplesFromConfig(getConf: (key: string) => unknown) {
  const nhLoc = getConf('nhLocation')
  const isDefaultPath =
    nhLoc &&
    typeof nhLoc === 'object' &&
    'uri' in nhLoc &&
    nhLoc.uri === '/path/to/my.nh'

  const nh = isDefaultPath
    ? undefined
    : await openLocation(nhLoc as Parameters<typeof openLocation>[0]).readFile(
        'utf8',
      )

  return {
    samples: normalize(getConf('samples') as SampleConfig),
    tree: nh ? parseNewick(nh) : undefined,
  }
}
