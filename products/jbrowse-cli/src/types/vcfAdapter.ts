import { decodeURIComponentNoThrow } from '../util'
import { createIndexingStream, parseAttributes } from './streamUtils'

import type { Track } from '../base'

export async function* indexVcf({
  config,
  attributesToIndex,
  inLocation,
  outLocation,
  quiet,
}: {
  config: Track
  attributesToIndex: string[]
  inLocation: string
  outLocation: string
  typesToExclude: string[]
  quiet: boolean
}) {
  const { trackId } = config
  const { rl, progressBar } = await createIndexingStream({
    inLocation,
    outLocation,
    trackId,
    quiet,
  })

  for await (const line of rl) {
    if (line.startsWith('#')) {
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [ref, pos, id, _ref, _alt, _qual, _filter, info] = line.split('\t')
    const fields = parseAttributes(info!, decodeURIComponentNoThrow)
    const end = fields.END

    const locStr = `${ref}:${pos!}..${end || +pos! + 1}`
    if (id === '.') {
      continue
    }

    const infoAttrs = attributesToIndex
      .map(attr => fields[attr])
      .filter((f): f is string => !!f)

    const ids = id!.split(',')
    for (const id of ids) {
      const attrs = [id]
      const record = JSON.stringify([
        encodeURIComponent(locStr),
        encodeURIComponent(trackId),
        encodeURIComponent(id || ''),
        ...infoAttrs.map(a => encodeURIComponent(a || '')),
      ]).replaceAll(',', '|')
      yield `${record} ${[...new Set(attrs)].join(' ')}\n`
    }
  }

  progressBar.stop()
}
