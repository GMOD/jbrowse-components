import { decodeURIComponentNoThrow } from '../util.ts'
import {
  createReadlineInterface,
  getLocalOrRemoteStream,
  parseAttributes,
} from './common.ts'

export async function* indexVcf({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  onStart,
  onUpdate,
}: {
  config: { trackId: string }
  attributesToIndex: string[]
  inLocation: string
  outDir: string
  onStart: (totalBytes: number) => void
  onUpdate: (progressBytes: number) => void
}) {
  const { trackId } = config
  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })

  const rl = createReadlineInterface(stream, inLocation)
  const encodedTrackId = encodeURIComponent(trackId)

  for await (const line of rl) {
    if (line.startsWith('#')) {
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [ref, pos, id, _ref, _alt, _qual, _filter, info] = line.split('\t')

    if (id === '.') {
      continue
    }

    const fields = parseAttributes(info!, decodeURIComponentNoThrow)
    const end = fields.END
    const locStr = `${ref}:${pos}..${end || +pos! + 1}`
    const encodedLocStr = encodeURIComponent(locStr)

    const infoAttrs = attributesToIndex
      .map(attr => fields[attr])
      .filter((f): f is string => !!f)

    const encodedInfoAttrs = infoAttrs.map(a => `"${encodeURIComponent(a)}"`)

    for (const variantId of id!.split(',')) {
      const encodedId = encodeURIComponent(variantId)
      const record = `["${encodedLocStr}"|"${encodedTrackId}"|"${encodedId}"${encodedInfoAttrs.length > 0 ? `|${encodedInfoAttrs.join('|')}` : ''}]`
      yield `${record} ${variantId}\n`
    }
  }
}
