import readline from 'readline'
import { createGunzip } from 'zlib'
import { SingleBar, Presets } from 'cli-progress'

// locals
import { decodeURIComponentNoThrow, getLocalOrRemoteStream } from '../util'
import type { Track } from '../base'

export async function* indexVcf({
  config,
  attributesToIndex,
  inLocation,
  outLocation,
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

  const gzStream = /.b?gz$/.exec(inLocation)
    ? // @ts-expect-error
      stream.pipe(createGunzip())
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

    const locStr = `${ref}:${pos!}..${end || +pos! + 1}`
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

  progressBar.stop()
}
