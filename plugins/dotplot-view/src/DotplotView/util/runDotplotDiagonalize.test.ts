import { dotplotDisplaysReady } from './runDotplotDiagonalize.ts'

import type { DotplotViewModel } from '../model.ts'

function makeModel(dotplotDisplays: { rpcData?: unknown; error?: unknown }[]) {
  return { dotplotDisplays } as unknown as DotplotViewModel
}

test('dotplotDisplaysReady is true when every display has rpcData', () => {
  const m = makeModel([{ rpcData: { points: [] } }])
  expect(dotplotDisplaysReady(m)).toBe(true)
})

test('dotplotDisplaysReady is true when a display has an error', () => {
  const m = makeModel([{ error: new Error('rpc failed') }])
  expect(dotplotDisplaysReady(m)).toBe(true)
})

test('dotplotDisplaysReady is false when any display has neither', () => {
  const m = makeModel([{ rpcData: {} }, {}])
  expect(dotplotDisplaysReady(m)).toBe(false)
})

test('dotplotDisplaysReady is true on an empty model', () => {
  expect(dotplotDisplaysReady(makeModel([]))).toBe(true)
})
