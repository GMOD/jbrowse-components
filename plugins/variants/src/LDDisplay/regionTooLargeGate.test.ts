import { getMembers } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer.
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

// A tabix LD file's index prices a region before any pair downloads, so the
// worker refuses an over-budget one and the display raises the banner instead
// of drawing, rather than parsing the whole region to find it too big.
test('the fetch carries the byte budget and a refusal raises the banner', async () => {
  const { display, view, mockRpcCall } = createTestEnvironment().createDisplay()
  mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    Promise.resolve(
      method === 'RenderLDData'
        ? { regionTooLarge: true, bytes: 30_000_000 }
        : undefined,
    ),
  )

  expect(display.gateEnabled).toBe(true)
  view.zoomTo(view.maxBpPerPx)
  await waitFor(() => {
    expect(display.regionTooLarge).toBe(true)
  })

  const call = mockRpcCall.mock.calls.find(c => c[1] === 'RenderLDData')!
  expect(call[2].byteLimit).toBe(20_000_000)
  expect(display.rpcData).toBeNull()
})

test('force load sends no byte budget, so nothing is refused', async () => {
  const { display, view, mockRpcCall } = createTestEnvironment({
    displayConfig: { forceLoad: true },
  }).createDisplay()
  mockRpcCall.mockImplementation(() => new Promise(() => {}))

  view.zoomTo(view.maxBpPerPx)
  await waitFor(() => {
    expect(mockRpcCall.mock.calls.some(c => c[1] === 'RenderLDData')).toBe(true)
  })

  const call = mockRpcCall.mock.calls.find(c => c[1] === 'RenderLDData')!
  expect(call[2].byteLimit).toBeUndefined()
  expect(display.regionTooLarge).toBe(false)
})
