import { act, render } from '@testing-library/react'

import RenderCanvas from './RenderCanvas.tsx'
import { useRenderingBackend } from './useRenderingBackend.ts'

import type { RenderLifecycleModel } from './useRenderingBackend.ts'

jest.mock('./gpuDevice.ts', () => ({
  onDeviceLost: jest.fn(() => jest.fn()),
}))

// `renderHook` cannot pose the question this file is about. The hazard is an
// ORDERING inside one React commit: the ref callback runs in the commit phase,
// the `setCanvas` it schedules lands in a later render, and the passive effects
// in between are paired with an element the commit has already replaced. Driving
// the hook's returned functions by hand batches all of that into one render, so
// the stale pairing never appears and the test passes against a hook with no
// guard at all. Only a real mount of a keyed <canvas> reproduces it.
type Backend = { dispose: jest.Mock; setErrorHandler: jest.Mock }

function mockModel(): RenderLifecycleModel<Backend> {
  return {
    startRenderingBackend: jest.fn(),
    stopRenderingBackend: jest.fn(),
    renderNow: jest.fn(),
    renderError: undefined,
    setRenderError: jest.fn(),
  }
}

let retryFromHost: () => void = () => {}

function Host({
  factory,
  model,
}: {
  factory: (canvas: HTMLCanvasElement) => Promise<Backend>
  model: RenderLifecycleModel<Backend>
}) {
  const handle = useRenderingBackend(factory, model)
  retryFromHost = handle.retry
  return <RenderCanvas handle={handle} drawn={false} phase="ready" />
}

test('a re-init never builds a backend on an element the tree has dropped', async () => {
  // Asserted as "was this element still in the document when we initialized it",
  // not by comparing element identities — a mount legitimately runs through more
  // than one element, and node identity across a re-render answers a different
  // question than this one.
  //
  // A `contextVersion` bump remounts the canvas (`RenderCanvas` keys it on
  // `canvasKey`), so the effect the bump re-runs is paired with the element the
  // commit just replaced. Initializing there builds an entire second backend —
  // device, pipeline set, swap chain — on an element nothing shows, and on
  // WebGPU its teardown releases the swap chain of the canvas that IS showing,
  // whose HAL then cannot draw another frame.
  const live: boolean[] = []
  const factory = jest.fn((canvas: HTMLCanvasElement) => {
    live.push(canvas.isConnected)
    return Promise.resolve({ dispose: jest.fn(), setErrorHandler: jest.fn() })
  })

  render(<Host factory={factory} model={mockModel()} />)
  await act(async () => {})

  await act(async () => {
    retryFromHost()
  })
  await act(async () => {
    retryFromHost()
  })

  // One backend per mounted element: the mount plus one per retry. Unguarded
  // this is five, since each bump also initializes the element it replaced.
  expect(live).toEqual([true, true, true])
})
