import { renderSessionThumbnail } from './sessionThumbnail.ts'

afterEach(() => {
  jest.useRealTimers()
})

test('a thumbnail that times out aborts its export, so the next one can start', async () => {
  jest.useFakeTimers()
  const signals: AbortSignal[] = []
  const view = {
    exportSvg: ({ signal }: { signal: AbortSignal }) =>
      new Promise<string>((_, reject) => {
        signals.push(signal)
        signal.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      }),
  }
  await Promise.all([
    expect(renderSessionThumbnail([view])).rejects.toThrow(/took over/),
    jest.advanceTimersByTimeAsync(10_000),
  ])

  expect(signals[0]?.aborted).toBe(true)
  await Promise.all([
    expect(renderSessionThumbnail([view])).rejects.toThrow(/took over/),
    jest.advanceTimersByTimeAsync(10_000),
  ])
  expect(signals).toHaveLength(2)
})
