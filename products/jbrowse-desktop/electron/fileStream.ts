import { openAsBlob } from 'node:fs'

import { net } from 'electron'

// Web streams, not node ones: @gmod/faidx 2.0.5 changed generateFastaIndex to
// take `ReadableStream`/`WritableStream` (it pipeThroughs them), so handing it
// a node Readable fails at runtime with "fileDataStream.pipeThrough is not a
// function".
//
// Both branches produce a real `ReadableStream<Uint8Array>` on their own, so
// neither needs a cast: `openAsBlob` streams the file lazily rather than
// reading it in, and a fetch body already is one.
export async function getFileStream(
  location: { uri: string } | { localPath: string },
  // aborts a download; a local read is stopped by cancelling the stream
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  if ('localPath' in location) {
    return (await openAsBlob(location.localPath)).stream()
  }
  // Chromium's network stack, as the renderer's own requests use: Node's fetch
  // ignores the system proxy and the OS certificate store, so behind a proxy
  // or a TLS-inspecting network this was the one request in the app to fail
  const response = await net.fetch(location.uri, { signal })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${location.uri} status ${response.status} ${response.statusText}`,
    )
  }
  if (!response.body) {
    throw new Error(`No response body for ${location.uri}`)
  }
  return response.body
}
