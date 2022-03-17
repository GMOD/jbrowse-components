import { Gff3TabixAdapter, Track } from '../util'
import { isURL, createRemoteStream } from './common'
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
    gffGzLocation,
  } = adapter as Gff3TabixAdapter

  const uri = 'uri' in gffGzLocation ? gffGzLocation.uri : gffGzLocation.localPath
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
  console.log(`Indexing track with trackId: ${trackId}`)
  fileDataStream.on('data', chunk => {
    receivedBytes += chunk.length
    // send an update?
    // const progress = Math.round((receivedBytes / totalBytes) * 100)
    // console.log(`${progress}%`)
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
        ]).replace(/,/g, '|')

        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
  // console.log('done')
}
