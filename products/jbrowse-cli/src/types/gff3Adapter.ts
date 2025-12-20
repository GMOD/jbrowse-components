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

  const excludeSet = new Set(typesToExclude)
  const encodedTrackId = encodeURIComponent(trackId)

  for await (const line of rl) {
    if (!line.trim()) {
      continue
    } else if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      break
    }

    const [seq_id, , type, start, end, , , , col9] = line.split('\t')

    if (!excludeSet.has(type!)) {
      const col9attrs = parseAttributes(col9!, decodeURIComponentNoThrow)
      const attrs = attributesToIndex
        .map(attr => col9attrs[attr])
        .filter((f): f is string => !!f)

      if (attrs.length > 0) {
        const locStr = `${seq_id}:${start}..${end}`
        const encodedAttrs = attrs.map(a => `"${encodeURIComponent(a)}"`)
        const record = `["${encodeURIComponent(locStr)}"|"${encodedTrackId}"|${encodedAttrs.join('|')}]`
        const uniqueAttrs = [...new Set(attrs)]

        yield `${record} ${uniqueAttrs.join(' ')}\n`
      }
    }
  }

  progressBar.stop()
}
