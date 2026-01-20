import { decodeURIComponentNoThrow } from '../util.ts'
import {
  getLocalOrRemoteStream,
  parseAttributes,
  readLines,
} from './common.ts'

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
  const { totalBytes, stream } = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
  })

  onStart(totalBytes)

  if (!stream) {
    throw new Error(`Failed to fetch ${inLocation}: no response body`)
  }

  const inputStream = /.b?gz$/.exec(inLocation)
    ? // @ts-expect-error
      ReadableStream.from(stream).pipeThrough(new DecompressionStream('gzip'))
    : ReadableStream.from(stream)

  const rl = readLines(inputStream.getReader(), onUpdate)
  const excludeSet = new Set(featureTypesToExclude)
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
}
