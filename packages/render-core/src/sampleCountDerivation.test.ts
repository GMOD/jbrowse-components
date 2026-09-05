import { createRenderingBackend } from './createRenderingBackend.ts'
import { createGpuHal, MockHal } from './hal/index.ts'

import type { GpuHalOptions } from './hal/index.ts'
import type { PipelineDescriptor } from './hal/types.ts'

jest.mock('./hal/index.ts', () => ({
  ...jest.requireActual('./hal/index.ts'),
  createGpuHal: jest.fn(),
}))

const mockCreateGpuHal = jest.mocked(createGpuHal)

beforeEach(() => {
  mockCreateGpuHal.mockImplementation(
    (_canvas: HTMLCanvasElement, options: GpuHalOptions) =>
      Promise.resolve(new MockHal(options.passes)),
  )
})

function pass(id: string, coverage?: 'analytic'): PipelineDescriptor {
  return {
    id,
    wgslSource: '',
    glslVertex: '',
    glslFragment: '',
    instanceStride: 16,
    verticesPerInstance: 6,
    blend: true,
    vertexAttributes: [],
    coverage,
  }
}

async function sampleCountFor(
  passes: PipelineDescriptor[],
  sampleCount?: 1 | 4,
) {
  mockCreateGpuHal.mockClear()
  const backend = await createRenderingBackend(
    document.createElement('canvas'),
    {
      passes,
      uniformByteSize: 16,
      sampleCount,
      createGpuBackend: hal => hal,
      createCanvas2DBackend: () => {
        throw new Error('the GPU rung was expected')
      },
    },
  )
  expect(backend).toBeInstanceOf(MockHal)
  return mockCreateGpuHal.mock.calls[0]![1].sampleCount
}

test('a display whose every pass is analytic allocates no MSAA target', async () => {
  expect(
    await sampleCountFor([pass('a', 'analytic'), pass('b', 'analytic')]),
  ).toBe(1)
})

test('one registered pass leaning on MSAA holds the display at 4', async () => {
  expect(await sampleCountFor([pass('a', 'analytic'), pass('b')])).toBe(4)
})

test('an explicit sampleCount overrides the derivation in both directions', async () => {
  expect(await sampleCountFor([pass('a', 'analytic')], 4)).toBe(4)
  expect(await sampleCountFor([pass('a')], 1)).toBe(1)
})
