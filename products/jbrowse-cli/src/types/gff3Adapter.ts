import { decodeURIComponentNoThrow } from '../util'
import { createIndexingStream, parseAttributes } from './streamUtils'

import type { Track } from '../base'

export async function* indexGff3({
  config,
  attributesToIndex,
  inLocation,
  outLocation,
  typesToExclude,
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
    if (!line.trim()) {
      continue
    } else if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      break
    }

    const [seq_id, , type, start, end, , , , col9] = line.split('\t')
    const locStr = `${seq_id}:${start}..${end}`

    if (!typesToExclude.includes(type!)) {
      const col9attrs = parseAttributes(col9!, decodeURIComponentNoThrow)
      const attrs = attributesToIndex
        .map(attr => col9attrs[attr])
        .filter((f): f is string => !!f)

      if (attrs.length) {
        const record = JSON.stringify([
          encodeURIComponent(locStr),
          encodeURIComponent(trackId),
          ...attrs.map(a => encodeURIComponent(a)),
        ]).replaceAll(',', '|')

        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }

  progressBar.stop()
}
