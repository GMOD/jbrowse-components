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

// A canvas whose webgl2 context answers the driver-string query with a software
// rasterizer, and whose 2d context exists. The probe builds its own canvas, so
// spying the prototype is what reaches it.
function mockSoftwareRasterizer() {
  return jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(((id: string) => {
      if (id === 'webgl2') {
        return {
          getExtension: (name: string) =>
            name === 'WEBGL_debug_renderer_info'
              ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
              : null,
          getParameter: () =>
            'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
        }
      }
      return id === '2d' ? {} : null
    }) as unknown as HTMLCanvasElement['getContext'])
}

// The capability probe is memoized per module copy, so each of these needs its
// own — same reason graphicsCapabilities.test.ts loads fresh modules.
async function freshBackendFactory() {
  jest.resetModules()
  return (await import('./createRenderingBackend.ts')).createRenderingBackend
}

test('a software rasterizer takes the Canvas2D rung instead of WebGL2', async () => {
  mockSoftwareRasterizer()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const createGpuBackend = jest.fn(() => ({ dispose() {} }))
    await (
      await freshBackendFactory()
    )(document.createElement('canvas'), {
      ...OPTS,
      createGpuBackend,
      createCanvas2DBackend: () => ({ dispose() {} }),
    })

    // WebGL2 works on this machine — it is simply the wrong rung, so the ladder
    // steps over it rather than failing at it.
    //
    // The *absence* of the construction failure is what makes this test mean
    // anything. In jsdom `new WebGL2Hal` throws whatever happens, so landing on
    // Canvas2D is the outcome with or without this feature and
    // `not.toHaveBeenCalled()` alone would pass against a reverted change. Which
    // of the two warnings appears is the only thing that separates "stepped over
    // the rung" from "tried it and it failed".
    expect(createGpuBackend).not.toHaveBeenCalled()
    const warnings = warn.mock.calls.flat().join(' ')
    expect(warnings).toContain('software-rendered')
    expect(warnings).not.toContain('WebGL2 unavailable')
  } finally {
    jest.restoreAllMocks()
  }
})

// The property the cross-backend CI gate rests on. That gate runs under
// SwiftShader and diffs canvas2d against the GPU render, so if a pin did not
// beat the software check it would compare Canvas2D with itself, drift 0.00%,
// and pass while testing nothing.
test('an explicit webgl pin still takes WebGL2 on a software rasterizer', async () => {
  mockSoftwareRasterizer()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  setGpuOverride('webgl')
  try {
    await (
      await freshBackendFactory()
    )(document.createElement('canvas'), {
      ...OPTS,
      createCanvas2DBackend: () => ({ dispose() {} }),
    })

    // Same discrimination in reverse: the pin must produce a rung that was
    // *attempted* (and, in jsdom, failed to construct) rather than one skipped.
    const warnings = warn.mock.calls.flat().join(' ')
    expect(warnings).toContain('WebGL2 unavailable')
    expect(warnings).not.toContain('software-rendered')
  } finally {
    setGpuOverride(null)
    jest.restoreAllMocks()
  }
})

test('a webgpu pin fails visibly instead of quietly running on WebGL2', async () => {
  // jsdom has no navigator.gpu, so this is the machine the flag is most likely
  // to be used on by mistake. Without the pin the same canvas falls to WebGL2
  // and then Canvas2D, and the page renders — which is precisely the outcome
  // that makes `?renderer=webgpu` useless for comparing backends, because it is
  // indistinguishable from passing no parameter at all.
  setGpuOverride('webgpu')
  try {
    const error = await createRenderingBackend(makeCanvas(), {
      ...OPTS,
      // Would succeed if the ladder reached it. It must not.
      createCanvas2DBackend: () => ({ dispose() {} }),
    }).then(
      () => undefined,
      (e: unknown) => e,
    )

    expect(`${error}`).toContain('?renderer=webgpu')
    expect(`${error}`).toContain('Not falling back to WebGL2')
  } finally {
    setGpuOverride(null)
  }
})
