import {
  fetchAndMaybeUnzip,
  fetchAndMaybeUnzipText,
} from './fetchAndMaybeUnzip.ts'
import { stopStopToken } from './stopToken.ts'

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
