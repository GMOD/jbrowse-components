import { createRenderingBackend } from './createRenderingBackend.ts'
import { setGpuOverride } from './gpuDevice.ts'

// No mocking: in jsdom `navigator.gpu` is absent and `<canvas>` has no real
// contexts, so a plain canvas walks the whole ladder for real — WebGPU declines
// for lack of a device, WebGL2 throws, Canvas2D throws — which is exactly the
// shape this is about.
function makeCanvas() {
  const canvas = document.createElement('canvas')
  canvas.getContext = (() => null) as HTMLCanvasElement['getContext']
  return canvas
}

const OPTS = {
  passes: [],
  uniformByteSize: 16,
  createGpuBackend: () => ({ dispose() {} }),
  createCanvas2DBackend: (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    return { dispose() {} }
  },
}

test('a total ladder failure reports every rung, not just the last', async () => {
  const error = await createRenderingBackend(makeCanvas(), OPTS).then(
    () => undefined,
    (e: unknown) => e,
  )

  // AggregateError specifically: core's `formatErrorStack` walks `.errors`, so
  // this is what puts the WebGL2 reason into the stack-trace dialog rather than
  // leaving it in a console nobody reporting the bug has open.
  expect(error).toBeInstanceOf(AggregateError)
  const { errors } = error as AggregateError
  expect(errors.map(e => `${e}`).join('\n')).toContain(
    'WebGL2 context not available',
  )
  // and the rung that could not be fallen back from is still the headline
  expect(`${error}`).toContain('Canvas 2D context not available')
})

test('the Canvas2D failure is rethrown bare when no rung had anything to add', async () => {
  // `?renderer=canvas2d` short-circuits the ladder before either GPU rung runs,
  // so nothing is collected. Wrapping a lone error in an AggregateError would
  // bury the only real cause a level deeper in the dialog for no gain.
  setGpuOverride('canvas2d')
  try {
    const error = await createRenderingBackend(makeCanvas(), {
      ...OPTS,
      createCanvas2DBackend: () => {
        throw new Error('boom')
      },
    }).then(
      () => undefined,
      (e: unknown) => e,
    )
    expect(error).not.toBeInstanceOf(AggregateError)
    expect(`${error}`).toContain('boom')
  } finally {
    setGpuOverride(null)
  }
})
