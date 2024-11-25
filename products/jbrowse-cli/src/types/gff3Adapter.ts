import readline from 'readline'
import { createGunzip } from 'zlib'
import { SingleBar, Presets } from 'cli-progress'

// locals
import { decodeURIComponentNoThrow, getLocalOrRemoteStream } from '../util'
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

  // progress bar code was aided by blog post at
  // https://webomnizz.com/download-a-file-with-progressbar-using-node-js/
  const progressBar = new SingleBar(
    {
      format: `{bar} ${trackId} {percentage}% | ETA: {eta}s`,
      etaBuffer: 2000,
    },
    Presets.shades_classic,
  )

  let receivedBytes = 0
  const { totalBytes, stream } = await getLocalOrRemoteStream(
    inLocation,
    outLocation,
  )

  if (!quiet) {
    progressBar.start(totalBytes, 0)
  }

  // @ts-expect-error
  stream.on('data', chunk => {
    receivedBytes += chunk.length
    progressBar.update(receivedBytes)
  })

  const rl = readline.createInterface({
    // @ts-expect-error
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

    if (!typesToExclude.includes(type!)) {
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

  progressBar.stop()
}
