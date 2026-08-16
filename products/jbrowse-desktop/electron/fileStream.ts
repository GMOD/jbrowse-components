import { openAsBlob } from 'node:fs'

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
  // aborts the request itself, which is what stops a download the caller has
  // stopped waiting for. Cancelling the returned stream ends the read either
  // way, so the local branch needs nothing.
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  if ('localPath' in location) {
    return (await openAsBlob(location.localPath)).stream()
  }
  const response = await fetch(location.uri, { signal })
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
