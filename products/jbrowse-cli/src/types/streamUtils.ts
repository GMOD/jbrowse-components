import { Presets, SingleBar } from 'cli-progress'

import { getLocalOrRemoteStream } from '../util'

async function* readLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  progressBar: SingleBar,
) {
  const decoder = new TextDecoder()
  let buffer = ''
  let receivedBytes = 0

  try {
    let result = await reader.read()
    while (!result.done) {
      receivedBytes += result.value.length
      progressBar.update(receivedBytes)
      buffer += decoder.decode(result.value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop()!
      for (const line of lines) {
        yield line
      }
      result = await reader.read()
    }
  } finally {
    reader.releaseLock()
  }

  buffer += decoder.decode()
  if (buffer) {
    yield buffer
  }
}

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

  const { totalBytes, stream } = await getLocalOrRemoteStream(
    inLocation,
    outLocation,
  )

  if (!quiet) {
    progressBar.start(totalBytes, 0)
  }

  if (!stream) {
    throw new Error(`Failed to fetch ${inLocation}: no response body`)
  }

  const decompressor = new DecompressionStream('gzip') as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >
  const inputStream = /.b?gz$/.exec(inLocation)
    ? stream.pipeThrough(decompressor)
    : stream

  const rl = readLines(inputStream.getReader(), progressBar)

  return { rl, progressBar }
}

export function parseAttributes(
  infoString: string,
  decodeFunc: (s: string) => string,
) {
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
