/**
 * @jest-environment node
 */

import { runAbortableJob } from './abortableJob.ts'

test('the signal aborts when the registered id is aborted', async () => {
  const jobs = new Map<string, AbortController>()
  let seen: AbortSignal | undefined
  const pending = runAbortableJob(jobs, 'a', async signal => {
    seen = signal
    await new Promise(resolve => {
      signal.addEventListener('abort', resolve)
    })
    return 'done'
  })

  jobs.get('a')!.abort()

  await expect(pending).resolves.toBe('done')
  expect(seen!.aborted).toBe(true)
})

// the id is the renderer's handle and it cancels whenever its dialog closes,
// which is normally after the run finished. A registry that kept finished jobs
// would let that late cancel land on whatever registered the id next.
test('a finished job is forgotten, however it finished', async () => {
  const jobs = new Map<string, AbortController>()

  await runAbortableJob(jobs, 'a', async () => 'ok')
  expect(jobs.size).toBe(0)

  await expect(
    runAbortableJob(jobs, 'a', () => Promise.reject(new Error('nope'))),
  ).rejects.toThrow('nope')
  expect(jobs.size).toBe(0)
})

test('two jobs abort independently', async () => {
  const jobs = new Map<string, AbortController>()
  const signals: Record<string, AbortSignal> = {}
  const run = (id: string) =>
    runAbortableJob(jobs, id, async signal => {
      signals[id] = signal
      await new Promise(resolve => {
        setTimeout(resolve, 0)
      })
      return signal.aborted
    })

  const first = run('a')
  const second = run('b')
  jobs.get('a')!.abort()

  expect(await first).toBe(true)
  expect(await second).toBe(false)
  expect(signals.b!.aborted).toBe(false)
})
