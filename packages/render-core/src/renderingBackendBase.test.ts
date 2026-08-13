import { MockHal } from './hal/mockHal.ts'
import {
  Canvas2DRenderingBackendBase,
  GpuRenderingBackendBase,
} from './renderingBackendBase.ts'

// The chain this pins is short and was broken for three of the eleven backends:
// `useRenderingBackend` hands the backend a handler that sets `renderError`, the
// backend forwards it to the HAL, and the HAL's OOM reporter calls it when an
// allocation exceeds a device limit. Break any link and an over-large view
// paints blank with only a console line — the failure the "too much data to
// render on this GPU, zoom in" banner exists to replace.
//
// It was broken because `setErrorHandler` was OPTIONAL at the hook and three
// backends (alignments, dotplot, synteny — the three largest allocators in the
// app) implemented their interfaces standalone rather than extending a base.
// The contract is required now, so a new backend that forgets is a compile
// error; what this checks is that extending the base is in fact enough.

class TestGpuBackend extends GpuRenderingBackendBase {}
class TestCanvas2DBackend extends Canvas2DRenderingBackendBase {}

test('a GPU backend forwards its error handler to the HAL', () => {
  const hal = new MockHal([])
  const backend = new TestGpuBackend(hal, 64)
  const seen: Error[] = []

  backend.setErrorHandler(e => {
    seen.push(e)
  })
  // What the HALs' OomReporter does on an over-limit allocation.
  hal.errorHandler?.(new Error('vertex buffer exceeds device limit'))

  expect(seen.map(e => e.message)).toEqual([
    'vertex buffer exceeds device limit',
  ])
})

test('a Canvas2D backend accepts one and drops it', () => {
  // No GPU resources, so no OOM channel — but the hook wires every backend the
  // same way, and a throw here would take the whole init down.
  const backend = new TestCanvas2DBackend(document.createElement('canvas'))
  expect(() => {
    backend.setErrorHandler(() => {})
  }).not.toThrow()
})
