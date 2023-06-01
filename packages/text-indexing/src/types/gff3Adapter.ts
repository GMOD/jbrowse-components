import { createGunzip } from 'zlib'
import readline from 'readline'
import { Track } from '../util'
import { getLocalOrRemoteStream } from './common'
import { checkAbortSignal } from '@jbrowse/core/util'

export async function* indexGff3(
  config: Track,
  attributes: string[],
  inLocation: string,
  outLocation: string,
  typesToExclude: string[],
  quiet: boolean,
  statusCallback: (message: string) => void,
  signal?: AbortSignal,
) {
  const { trackId } = config
  let receivedBytes = 0
  const { totalBytes, stream } = await getLocalOrRemoteStream(
    inLocation,
    outLocation,
  )
  stream.on('data', chunk => {
    receivedBytes += chunk.length
    // send an update?
    const progress = Math.round((receivedBytes / totalBytes) * 100)
    statusCallback(`${progress}`)
  })
  const rl = readline.createInterface({
    input: inLocation.match(/.b?gz$/) ? stream.pipe(createGunzip()) : stream,
  })

  for await (const line of rl) {
    if (line.startsWith('#')) {
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
            decodeURIComponent(val).trim().split(',').join(' '),
          ]),
      )
      const attrs = attributes
        .map(attr => col9attrs[attr])
        .filter((f): f is string => !!f)

      if (attrs.length) {
        const record = JSON.stringify([
          encodeURIComponent(locStr),
          encodeURIComponent(trackId),
          ...attrs.map(a => encodeURIComponent(a)),
        ]).replaceAll(',', '|')

        // Check abort signal
        checkAbortSignal(signal)
        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
  // console.log('done')
}
