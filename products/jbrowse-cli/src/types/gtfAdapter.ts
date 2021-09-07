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

  const regex = /(")+/g

  for await (const line of rl) {
    if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      break
    }

    const [seq_name, , type, start, end, , , , col9] = line.split('\t')
    const locStr = `${seq_name}:${start}..${end}`

    if (!typesToExclude.includes(type)) {
      const col9attrs = col9.split('; ')
      const name = col9attrs
        .find(f => f.startsWith('gene_name'))
        ?.split(' ')[1]
        .trim()
        .replace(regex, '')
      const id = col9attrs
        .find(f => f.startsWith('gene_id'))
        ?.split(' ')[1]
        .trim()
        .replace(regex, '')
      const attrs = attributes.map(attr =>
        col9attrs
          .find(f => f.startsWith(attr))
          ?.split(' ')[1]
          .trim()
          .replace(regex, ''),
      )
      if (name || id) {
        const record = JSON.stringify([locStr, trackId, name, id])
        const buff = Buffer.from(record).toString('base64')
        yield `${buff} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
  progressBar.stop()
}
