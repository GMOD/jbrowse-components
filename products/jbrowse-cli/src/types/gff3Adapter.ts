import { Gff3TabixAdapter, Track } from '../base'
import { isURL, createRemoteStream } from '../types/common'
import { SingleBar, Presets } from 'cli-progress'
import { createGunzip } from 'zlib'
import readline from 'readline'
import path from 'path'
import fs from 'fs'

export async function* indexGff3(
  config: Track,
  attributes: string[],
  outLocation: string,
  typesToExclude: string[],
  quiet: boolean,
) {
  const { adapter, trackId } = config
  const {
    gffGzLocation: { uri },
  } = adapter as Gff3TabixAdapter

  // progress bar code was aided by blog post at
  // https://webomnizz.com/download-a-file-with-progressbar-using-node-js/
  const progressBar = new SingleBar(
    {
      format: '{bar} ' + trackId + ' {percentage}% | ETA: {eta}s',
      etaBuffer: 2000,
    },
    Presets.shades_classic,
  )

  let fileDataStream
  let totalBytes = 0
  let receivedBytes = 0
  if (isURL(uri)) {
    fileDataStream = await createRemoteStream(uri)
    totalBytes = +(fileDataStream.headers['content-length'] || 0)
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(outLocation, uri)
    totalBytes = fs.statSync(filename).size
    fileDataStream = fs.createReadStream(filename)
  }

  if (!quiet) {
    progressBar.start(totalBytes, 0)
  }

  fileDataStream.on('data', chunk => {
    receivedBytes += chunk.length
    progressBar.update(receivedBytes)
  })

  const rl = readline.createInterface({
    input: uri.endsWith('.gz')
      ? fileDataStream.pipe(createGunzip())
      : fileDataStream,
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
          .map(([key, val]) => [key.trim(), val.trim().split(',').join(' ')]),
      )
      const attrs = attributes
        .map(attr => col9attrs[attr])
        .filter((f): f is string => !!f)

      if (attrs.length) {
        const record = JSON.stringify([
          encodeURIComponent(locStr),
          encodeURIComponent(trackId),
          ...attrs.map(a => encodeURIComponent(a)),
        ]).replace(/,/g, '|')
        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }

  progressBar.stop()
}
