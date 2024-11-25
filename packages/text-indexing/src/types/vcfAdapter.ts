import readline from 'readline'
import { createGunzip } from 'zlib'

// locals
import { decodeURIComponentNoThrow } from '../util'
import { getLocalOrRemoteStream } from './common'

export async function* indexVcf({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  onStart,
  onUpdate,
}: {
  config: any
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
    onTotalBytes: onStart,
    onBytesReceived: onUpdate,
  })

  const gzStream = /.b?gz$/.exec(inLocation)
    ? stream.pipe(createGunzip())
    : stream

  const rl = readline.createInterface({
    input: gzStream,
  })

  for await (const line of rl) {
    if (line.startsWith('#')) {
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [ref, pos, id, _ref, _alt, _qual, _filter, info] = line.split('\t')

    // turns gff3 attrs into a map, and converts the arrays into space
    // separated strings
    const fields = Object.fromEntries(
      info!
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

    const end = fields.END

    const locStr = `${ref}:${pos}..${end || +pos! + 1}`
    if (id === '.') {
      continue
    }

    const infoAttrs = attributesToIndex
      .map(attr => fields[attr])
      .filter((f): f is string => !!f)

    const ids = id!.split(',')
    for (const id of ids) {
      const attrs = [id]
      const record = JSON.stringify([
        encodeURIComponent(locStr),
        encodeURIComponent(trackId),
        encodeURIComponent(id || ''),
        ...infoAttrs.map(a => encodeURIComponent(a || '')),
      ]).replaceAll(',', '|')
      yield `${record} ${[...new Set(attrs)].join(' ')}\n`
    }
  }
}
