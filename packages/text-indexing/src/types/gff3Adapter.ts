import readline from 'readline'
import { createGunzip } from 'zlib'

// locals
import { decodeURIComponentNoThrow } from '../util'
import { getLocalOrRemoteStream } from './common'

export async function* indexGff3({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  featureTypesToExclude,
  onStart,
  onUpdate,
}: {
  config: { trackId: string }
  attributesToIndex: string[]
  inLocation: string
  outDir: string
  featureTypesToExclude: string[]
  onStart: (totalBytes: number) => void
  onUpdate: (progressBytes: number) => void
}) {
  const { trackId } = config
  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onTotalBytes: onStart,
    onBytesReceived: onUpdate,
  })

  const rl = readline.createInterface({
    input: /.b?gz$/.exec(inLocation) ? stream.pipe(createGunzip()) : stream,
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

    if (!featureTypesToExclude.includes(type!)) {
      // turns gff3 attrs into a map, and converts the arrays into space
      // separated strings
      const col9attrs = Object.fromEntries(
        col9!
          .split(';')
          .map(f => f.trim())
          .filter(f => !!f)
          .map(f => f.split('='))
          .map(([key, val]) => [
            key!.trim(),
            val
              ? decodeURIComponentNoThrow(val).trim().split(',').join(' ')
              : undefined,
          ]),
      )
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
}
