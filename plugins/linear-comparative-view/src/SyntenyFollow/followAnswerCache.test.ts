import { createFollowAnswerCache } from './followAnswerCache.ts'
import { resolveFollowSpan } from './resolveFollowSpan.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { FollowStep } from './planFollowStep.ts'
import type { FollowAnswer } from './resolveFollowSpan.ts'

jest.mock('./resolveFollowSpan.ts', () => ({
  resolveFollowSpan: jest.fn(),
}))

const resolve = jest.mocked(resolveFollowSpan)

const ANSWER: FollowAnswer = {
  span: { refName: 'ctgA', start: 0, end: 100 },
  approximate: false,
}

// Only the five fields the key is built from matter here.
function step({
  featId = 'f0',
  start = 1000,
  windowInsideFeat = true,
}: { featId?: string; start?: number; windowInsideFeat?: boolean } = {}) {
  return {
    display: { id: 'd0' } as LinearSyntenyDisplayModel,
    feat: { id: featId },
    window: { refName: 'ctgA', start, end: start + 1000 },
    toMate: true,
    hasCigar: true,
    windowInsideFeat,
    envelope: undefined,
  } as unknown as FollowStep
}

beforeEach(() => {
  resolve.mockReset()
  resolve.mockResolvedValue(ANSWER)
})

// The reason this holds a promise rather than a span: applying an answer
// flushes the moved row's coarse blocks and refetches it, so one settle asks
// the same question three times before the first answer has landed.
test('the same question in flight rides one resolve', async () => {
  const cache = createFollowAnswerCache()
  const answers = await Promise.all([
    cache(step()),
    cache(step()),
    cache(step()),
  ])
  expect(resolve).toHaveBeenCalledTimes(1)
  expect(answers).toEqual([ANSWER, ANSWER, ANSWER])
})

test('a different window is a different question', async () => {
  const cache = createFollowAnswerCache()
  await cache(step())
  await cache(step({ start: 2000 }))
  expect(resolve).toHaveBeenCalledTimes(2)
})

test('a different block on the same window is a different question', async () => {
  const cache = createFollowAnswerCache()
  await cache(step())
  await cache(step({ featId: 'f1' }))
  expect(resolve).toHaveBeenCalledTimes(2)
})

// The envelope is a union of every loaded block, so the same window resolves
// differently once more of them arrive — there is no key that means it.
test('an envelope answer is never cached', async () => {
  const cache = createFollowAnswerCache()
  await cache(step({ windowInsideFeat: false }))
  await cache(step({ windowInsideFeat: false }))
  expect(resolve).toHaveBeenCalledTimes(2)
})

test('a rejection is not replayed to the next pass', async () => {
  const cache = createFollowAnswerCache()
  resolve.mockRejectedValueOnce(new Error('nope'))
  await expect(cache(step())).rejects.toThrow('nope')
  await expect(cache(step())).resolves.toEqual(ANSWER)
  expect(resolve).toHaveBeenCalledTimes(2)
})

// A slow failure landing after the anchor has moved on: it clears the entry it
// owns, never whichever one is current, or the answer to a question nobody has
// asked yet would be evicted the moment it was stored.
test('a late rejection does not evict the answer that replaced it', async () => {
  const cache = createFollowAnswerCache()
  let fail: (e: unknown) => void = () => {}
  resolve.mockReturnValueOnce(
    new Promise((_, reject) => {
      fail = reject
    }),
  )
  const first = cache(step())
  first.catch(() => {})

  await cache(step({ start: 2000 }))
  fail(new Error('nope'))
  await expect(first).rejects.toThrow('nope')

  await cache(step({ start: 2000 }))
  expect(resolve).toHaveBeenCalledTimes(2)
})
