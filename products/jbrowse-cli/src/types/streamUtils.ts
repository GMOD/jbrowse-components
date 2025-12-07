import readline from 'readline'
import { createGunzip } from 'zlib'

import { Presets, SingleBar } from 'cli-progress'

import { getLocalOrRemoteStream } from '../util'

export async function createIndexingStream({
  inLocation,
  outLocation,
  trackId,
  quiet,
}: {
  inLocation: string
  outLocation: string
  trackId: string
  quiet: boolean
}) {
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

  // @ts-expect-error
  const inputStream = /.b?gz$/.exec(inLocation) ? stream.pipe(createGunzip()) : stream

  const rl = readline.createInterface({
    input: inputStream,
  })

  return { rl, progressBar }
}

export function parseAttributes(infoString: string, decodeFunc: (s: string) => string) {
  return Object.fromEntries(
    infoString
      .split(';')
      .map(f => f.trim())
      .filter(f => !!f)
      .map(f => f.split('='))
      .map(([key, val]) => [
        key!.trim(),
        val ? decodeFunc(val).trim().split(',').join(' ') : undefined,
      ]),
  )
}
