import { Track, GtfTabixAdapter } from '../base'
import { isURL, createRemoteStream } from '../types/common'
import { SingleBar, Presets } from 'cli-progress'
import { createGunzip } from 'zlib'
import readline from 'readline'
import path from 'path'
import fs from 'fs'

export async function* indexGtf(
  config: Track,
  attributes: string[],
  outLocation: string,
  typesToExclude: string[],
  quiet: boolean,
) {
  const { adapter, trackId } = config
  const {
    gtfGzLocation: { uri },
  } = adapter as GtfTabixAdapter

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
    const filename = path.join(outLocation, uri)
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

  const gzStream = uri.endsWith('.gz')
    ? fileDataStream.pipe(createGunzip())
    : fileDataStream

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
      const name = col9Attrs['gene_name'] || ''
      const id = col9Attrs['gene_id'] || ''
      const attrs = attributes
        .map(attr => col9Attrs[attr])
        .filter((f): f is string => !!f)

      const restAttrs = attributes
        .filter(attr => attr !== 'gene_name' && attr !== 'gene_id')
        .map(attr => col9Attrs[attr])
        .filter((f): f is string => !!f)
      if (name || id) {
        const record = JSON.stringify([
          encodeURIComponent(locStr),
          encodeURIComponent(trackId),
          encodeURIComponent(name),
          encodeURIComponent(id),
          ...restAttrs.map(a => encodeURIComponent(a || '')),
        ]).replace(/,/g, '|')
        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
  progressBar.stop()
}
