import {
  fetchAndMaybeUnzip,
  fetchAndMaybeUnzipText,
} from './fetchAndMaybeUnzip.ts'
import { statusMessageText, statusSource } from './progress.ts'
import { stopStopToken } from './stopToken.ts'

import type { RpcStatus } from './progress.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

function fakeFilehandle(body: string) {
  const seen: { onProgress?: unknown; signal?: AbortSignal }[] = []
  return {
    seen,
    handle: {
      readFile: (opts?: { onProgress?: unknown; signal?: AbortSignal }) => {
        seen.push({ onProgress: opts?.onProgress, signal: opts?.signal })
        return Promise.resolve(new TextEncoder().encode(body))
      },
    } as unknown as GenericFilehandle,
  }
}

describe('fetchAndMaybeUnzip', () => {
  // generic-filehandle2 only takes its getReader loop when onProgress is set, so
  // this is what carries "nobody is listening" down to the reader. Not a speed
  // claim in either direction — the loop measures FASTER below ~10MB
  // (agent-docs/measurements/download-read-path.json); what it pins is that the
  // caller's decision survives the trip.
  it('hands the reader no onProgress when there is no status callback', async () => {
    const { seen, handle } = fakeFilehandle('hello')
    await fetchAndMaybeUnzip(handle)
    expect(seen[0]!.onProgress).toBeUndefined()
  })

  it('hands the reader an onProgress when a status callback is present', async () => {
    const { seen, handle } = fakeFilehandle('hello')
    await fetchAndMaybeUnzip(handle, { statusCallback: () => {} })
    expect(seen[0]!.onProgress).toEqual(expect.any(Function))
  })

  it('bridges the stop token to the read signal', async () => {
    const stopToken = 'fetch-unzip-token'
    const { seen, handle } = fakeFilehandle('hello')
    await fetchAndMaybeUnzip(handle, { stopToken })
    const { signal } = seen[0]!
    expect(signal!.aborted).toBe(false)
    stopStopToken(stopToken)
    // released once the read settled, so stopping afterwards must not abort it
    expect(signal!.aborted).toBe(false)
  })

  it('aborts the read of a token stopped mid-flight', async () => {
    const stopToken = 'fetch-unzip-midflight'
    let abortedDuringRead: boolean | undefined
    const handle = {
      readFile: async (opts?: { signal?: AbortSignal }) => {
        stopStopToken(stopToken)
        abortedDuringRead = opts?.signal?.aborted
        return new TextEncoder().encode('hello')
      },
    } as unknown as GenericFilehandle
    await fetchAndMaybeUnzip(handle, { stopToken })
    expect(abortedDuringRead).toBe(true)
  })

  it('decodes text', async () => {
    const { handle } = fakeFilehandle('a\tb')
    expect(await fetchAndMaybeUnzipText(handle)).toBe('a\tb')
  })
})

// The source is taken off the handle, not passed in. That is what makes the
// stalled-load notice true of every download in the tree rather than of the
// handful of call sites that remembered to name their own file.
describe('the phase names the file the handle points at', () => {
  const handleWithSource = (source?: string) =>
    ({
      source,
      readFile: () => Promise.resolve(new TextEncoder().encode('hello')),
    }) as unknown as GenericFilehandle

  it('takes the url off the filehandle with no call site supplying one', async () => {
    const seen: RpcStatus[] = []
    await fetchAndMaybeUnzip(
      handleWithSource('https://example.com/hg38.chromAlias.txt'),
      { statusCallback: s => seen.push(s) },
      'Downloading chromosome aliases',
    )
    expect(statusMessageText(seen[0])).toBe('Downloading chromosome aliases')
    expect(statusSource(seen[0])).toBe(
      'https://example.com/hg38.chromAlias.txt',
    )
  })

  // a presigned link's credential lives in the query string, and this is the
  // layer that hands the address to a display
  it('drops the query string on the way out', async () => {
    const seen: RpcStatus[] = []
    await fetchAndMaybeUnzip(
      handleWithSource(
        'https://s3.amazonaws.com/b/hg38.2bit?X-Amz-Signature=x',
      ),
      { statusCallback: s => seen.push(s) },
    )
    expect(statusSource(seen[0])).toBe('https://s3.amazonaws.com/b/hg38.2bit')
  })

  // a Blob or a FileHandle: bytes the user handed the page, with no server to
  // go and check, so the phase stays the bare label it always was
  it('stays a plain label for a handle with no address', async () => {
    const seen: RpcStatus[] = []
    await fetchAndMaybeUnzip(handleWithSource(), {
      statusCallback: s => seen.push(s),
    })
    expect(seen[0]).toBe('Downloading file')
  })
})
