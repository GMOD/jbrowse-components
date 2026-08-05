import {
  acquireCanvas2D,
  acquiredCanvasContext,
  canvasContextError,
  noteCanvasContext,
} from './canvasContext.ts'

// jsdom's <canvas> has no real context implementations, so `getContext` is
// stubbed per test. That is the whole surface under test anyway: this module
// exists to turn `getContext`'s single undifferentiated `null` into a reason.
function makeCanvas(contexts: Partial<Record<string, unknown>>) {
  const canvas = document.createElement('canvas')
  canvas.getContext = ((kind: string) =>
    contexts[kind] ?? null) as HTMLCanvasElement['getContext']
  return canvas
}

test('a fresh canvas has no recorded kind', () => {
  expect(acquiredCanvasContext(makeCanvas({}))).toBeUndefined()
})

test('acquireCanvas2D returns the context and records the commitment', () => {
  const ctx = {}
  const canvas = makeCanvas({ '2d': ctx })
  expect(acquireCanvas2D(canvas)).toBe(ctx)
  expect(acquiredCanvasContext(canvas)).toBe('2d')
})

// The reason this module exists. Both messages keep the historical first clause
// (a jest `toThrow` elsewhere matches on it) and differ only in the diagnosis.
test('a conflicting kind is named, along with the remedy', () => {
  const canvas = makeCanvas({})
  noteCanvasContext(canvas, 'webgpu')

  expect(() => {
    acquireCanvas2D(canvas)
  }).toThrow('Canvas 2D context not available')

  const message = `${canvasContextError(canvas, '2d')}`
  expect(message).toContain('already committed to a WebGPU context')
  expect(message).toContain('RenderCanvas')
})

// `RenderCanvas` is the discriminator throughout: the remedy is named only when
// we know it applies. Both messages mention a committed context — the vague one
// as one of two possibilities — so matching on that phrase proves nothing, which
// is what the first draft of these tests got wrong.
test('an unknown cause says so rather than guessing', () => {
  const message = `${canvasContextError(makeCanvas({}), 'webgl2')}`
  expect(message).toContain('WebGL2 context not available')
  // the honest disjunction: we never took a context on this element, so we
  // cannot tell "unsupported" from "something else took it"
  expect(message).toContain('does not support it')
  expect(message).not.toContain('RenderCanvas')
})

test('re-requesting the kind already held is not reported as a conflict', () => {
  const canvas = makeCanvas({})
  noteCanvasContext(canvas, 'webgl2')
  expect(`${canvasContextError(canvas, 'webgl2')}`).not.toContain(
    'RenderCanvas',
  )
})

test('commitments are tracked per element, not globally', () => {
  const a = makeCanvas({})
  const b = makeCanvas({})
  noteCanvasContext(a, 'webgl2')
  expect(acquiredCanvasContext(b)).toBeUndefined()
  expect(`${canvasContextError(b, '2d')}`).not.toContain('RenderCanvas')
})
