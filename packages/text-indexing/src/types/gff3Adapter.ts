import { createGunzip } from 'zlib'
import readline from 'readline'

// locals
import { decodeURIComponentNoThrow } from '../util'
import { getLocalOrRemoteStream } from './common'

export async function* indexGff3({
  config,
  attributesToIndex,
  inLocation,
  outLocation,
  typesToExclude,
  onStart,
  onUpdate,
}: {
  config: any
  attributesToIndex: string[]
  inLocation: string
  outLocation: string
  typesToExclude: string[]
  onStart: (totalBytes: number) => void
  onUpdate: (progressBytes: number) => void
}) {
  const { trackId } = config

  let receivedBytes = 0
  const { totalBytes, stream } = await getLocalOrRemoteStream(
    inLocation,
    outLocation,
  )
  onStart(totalBytes)

  stream.on('data', chunk => {
    receivedBytes += chunk.length
    onUpdate(receivedBytes)
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

    if (!typesToExclude.includes(type)) {
      // turns gff3 attrs into a map, and converts the arrays into space
      // separated strings
      const col9attrs = Object.fromEntries(
        col9
          .split(';')
          .map(f => f.trim())
          .filter(f => !!f)
          .map(f => f.split('='))
          .map(([key, val]) => [
            key.trim(),
            decodeURIComponentNoThrow(val).trim().split(',').join(' '),
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
