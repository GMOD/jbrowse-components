import { Track, GtfAdapter } from '../base'
import { getLocalOrRemoteStream } from '../util'
import { SingleBar, Presets } from 'cli-progress'
import { createGunzip } from 'zlib'
import readline from 'readline'

export async function* indexGtf(
  config: Track,
  attributes: string[],
  outLocation: string,
  typesToExclude: string[],
  quiet: boolean,
) {
  const { adapter, trackId } = config
  const {
    gtfLocation: { uri },
  } = adapter as GtfAdapter

  // progress bar code was aided by blog post at
  // https://webomnizz.com/download-a-file-with-progressbar-using-node-js/
  const progressBar = new SingleBar(
    {
      format: '{bar} ' + trackId + ' {percentage}% | ETA: {eta}s',
      etaBuffer: 2000,
    },
    Presets.shades_classic,
  )

  let receivedBytes = 0
  const { totalBytes, stream } = await getLocalOrRemoteStream(uri, outLocation)

  if (!quiet) {
    progressBar.start(totalBytes, 0)
  }

  stream.on('data', chunk => {
    receivedBytes += chunk.length
    progressBar.update(receivedBytes)
  })

  const gzStream = uri.match(/.b?gz$/) ? stream.pipe(createGunzip()) : stream

  const rl = readline.createInterface({
    input: gzStream,
  })

  for await (const line of rl) {
    if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      break
    }

    const [seq_name, , type, start, end, , , , col9] = line.split('\t')
    const locStr = `${seq_name}:${start}..${end}`

    if (!typesToExclude.includes(type)) {
      const col9Attrs = Object.fromEntries(
        col9
          .split(';')
          .map(f => f.trim())
          .filter(f => !!f)
          .map(f => f.split(' '))
          .map(([key, val]) => {
            return [
              key.trim(),
              val.trim().split(',').join(' ').replace(/("|')/g, ''),
            ]
          }),
      )
      const attrs = attributes
        .map(attr => col9Attrs[attr])
        .filter((f): f is string => !!f)

      if (attrs.length) {
        const record = JSON.stringify([
          encodeURIComponent(locStr),
          encodeURIComponent(trackId),
          ...attrs.map(a => encodeURIComponent(a || '')),
        ]).replace(/,/g, '|')
        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
  progressBar.stop()
}
