import { decodeURIComponentNoThrow } from '../util.ts'
import {
  createReadlineInterface,
  getLocalOrRemoteStream,
  parseAttributes,
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
  console.error(
    `[DEBUG] indexGff3 starting for trackId=${trackId}, inLocation=${inLocation}`,
  )
  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })
  console.error(`[DEBUG] Got stream, creating readline interface`)

  const rl = createReadlineInterface(stream, inLocation)
  const excludeSet = new Set(featureTypesToExclude)
  const encodedTrackId = encodeURIComponent(trackId)

  let lineCount = 0
  let yieldCount = 0
  console.error(`[DEBUG] Starting to read lines`)
  for await (const line of rl) {
    lineCount++
    if (lineCount <= 5 || lineCount % 100 === 0) {
      console.error(`[DEBUG] Read line ${lineCount}: ${line.slice(0, 50)}...`)
    }
    if (!line.trim()) {
      continue
    } else if (line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      console.error(`[DEBUG] Found FASTA header, breaking at line ${lineCount}`)
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

        yieldCount++
        yield `${record} ${uniqueAttrs.join(' ')}\n`
      }
    }
  }
  console.error(
    `[DEBUG] indexGff3 finished: read ${lineCount} lines, yielded ${yieldCount} records`,
  )
}
