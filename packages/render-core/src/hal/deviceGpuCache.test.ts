import { spanMark } from '../marks/spanMark.ts'
import { WGSL_SOURCE } from '../shaders/spanMark.wgsl.generated.ts'
import {
  getDeviceLayouts,
  getOrBuildPipeline,
  pipelineRecipe,
  resetDeviceGpuCacheForTests,
} from './deviceGpuCache.ts'

import type { PipelineRecipe } from './deviceGpuCache.ts'
import type { PipelineDescriptor, SampleCount } from './types.ts'

// Enough of a GPUDevice to count layout construction. The real thing needs a
// browser; what this file pins is the memo, which is plain JS.
function fakeDevice() {
  const calls = { bindGroupLayouts: 0, pipelineLayouts: 0 }
  const device = {
    createBindGroupLayout: () => {
      calls.bindGroupLayouts++
      return { id: calls.bindGroupLayouts }
    },
    createPipelineLayout: () => {
      calls.pipelineLayouts++
      return { id: calls.pipelineLayouts }
    },
  }
  return { device: device as unknown as GPUDevice, calls }
}

const SPAN: PipelineDescriptor = spanMark.pass

function counting() {
  const built: PipelineRecipe[] = []
  const build = async (_layouts: unknown, recipe: PipelineRecipe) => {
    built.push(recipe)
    return { recipe } as unknown as GPURenderPipeline
  }
  return { built, build }
}

describe('deviceGpuCache', () => {
  // A WebGPU-only global, so jsdom has none and the layout builder reads it at
  // call time. Nothing in the app reaches that code without a real device.
  const shaderStage = { VERTEX: 1, FRAGMENT: 2 }
  let device: GPUDevice
  beforeAll(() => {
    Object.assign(globalThis, { GPUShaderStage: shaderStage })
  })
  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'GPUShaderStage')
  })
  beforeEach(() => {
    device = fakeDevice().device
  })
  afterEach(() => {
    resetDeviceGpuCacheForTests(device)
  })

  it('builds one set of layouts per device, not per HAL', () => {
    const own = fakeDevice()
    try {
      expect(getDeviceLayouts(own.device)).toBe(getDeviceLayouts(own.device))
      // uniform-only + textured, and their two pipeline layouts
      expect(own.calls.bindGroupLayouts).toBe(2)
      expect(own.calls.pipelineLayouts).toBe(2)
    } finally {
      resetDeviceGpuCacheForTests(own.device)
    }
  })

  it('gives two devices their own layouts', () => {
    const a = fakeDevice()
    const b = fakeDevice()
    try {
      expect(getDeviceLayouts(a.device)).not.toBe(getDeviceLayouts(b.device))
      expect(a.calls.bindGroupLayouts).toBe(2)
      expect(b.calls.bindGroupLayouts).toBe(2)
    } finally {
      resetDeviceGpuCacheForTests(a.device)
      resetDeviceGpuCacheForTests(b.device)
    }
  })

  // Every display of a type hands over the same module-level descriptors, and
  // many mount in one tick, so every ask lands before the first compile ends.
  it('dedupes concurrent asks for one recipe', async () => {
    let builds = 0
    let release: (p: GPURenderPipeline) => void = () => {}
    const pending = new Promise<GPURenderPipeline>(resolve => {
      release = resolve
    })
    const build = () => {
      builds++
      return pending
    }
    const asks = [1, 2, 3].map(() =>
      getOrBuildPipeline(device, pipelineRecipe(SPAN, WGSL_SOURCE, 4), build),
    )
    expect(builds).toBe(1)
    release({} as GPURenderPipeline)
    const [one, two, three] = await Promise.all(asks)
    expect(two).toBe(one)
    expect(three).toBe(one)
  })

  // The marks display clones a shape per mark, the ring view declares eight
  // rings and alignments draws gap and skip off one shader: each a new id over
  // content already compiled.
  it('shares one pipeline between descriptors that differ only in id', async () => {
    const { built, build } = counting()
    const ids = ['span', 'span#0', 'span#1']
    const pipelines = await Promise.all(
      ids.map(id =>
        getOrBuildPipeline(
          device,
          pipelineRecipe({ ...SPAN, id }, WGSL_SOURCE, 4),
          build,
        ),
      ),
    )
    expect(built).toHaveLength(1)
    expect(new Set(pipelines).size).toBe(1)
  })

  it('builds apart every recipe that differs in what the pipeline compiles', async () => {
    const { built, build } = counting()
    const [attr, ...attrs] = SPAN.vertexAttributes
    const layouts: PipelineDescriptor[] = [
      { ...SPAN, instanceStride: SPAN.instanceStride + 4 },
      { ...SPAN, vertexAttributes: [{ ...attr!, offsetBytes: 4 }, ...attrs] },
      { ...SPAN, vertexAttributes: [{ ...attr!, components: 3 }, ...attrs] },
      { ...SPAN, blend: false },
      { ...SPAN, blendState: { op: 'max' } },
      { ...SPAN, blendState: { op: 'behind' } },
      { ...SPAN, topology: 'line-list' },
      {
        ...SPAN,
        textures: [
          {
            textureBinding: 2,
            samplerBinding: 3,
            glTextureUnit: 0,
            glUniformName: 'u_colorRamp',
            filter: 'linear',
          },
        ],
      },
    ]
    const variants: [PipelineDescriptor, string][] = [
      [SPAN, WGSL_SOURCE],
      [SPAN, `${WGSL_SOURCE}\n`],
      ...layouts.map((desc): [PipelineDescriptor, string] => [
        desc,
        WGSL_SOURCE,
      ]),
    ]
    const counts: SampleCount[] = [4, 1]
    for (const sampleCount of counts) {
      for (const [desc, wgsl] of variants) {
        await getOrBuildPipeline(
          device,
          pipelineRecipe(desc, wgsl, sampleCount),
          build,
        )
      }
    }
    expect(built).toHaveLength(variants.length * counts.length)
    // and a second pass over the same content builds nothing
    for (const [desc, wgsl] of variants) {
      await getOrBuildPipeline(device, pipelineRecipe(desc, wgsl, 4), build)
    }
    expect(built).toHaveLength(variants.length * counts.length)
  })

  it('hands the builder the sample count it keyed on', async () => {
    const { built, build } = counting()
    await getOrBuildPipeline(
      device,
      pipelineRecipe(SPAN, WGSL_SOURCE, 1),
      build,
    )
    await getOrBuildPipeline(
      device,
      pipelineRecipe(SPAN, WGSL_SOURCE, 4),
      build,
    )
    expect(built.map(r => r.sampleCount)).toEqual([1, 4])
  })

  it('caches a compile failure rather than re-running it per display', async () => {
    let builds = 0
    const build = () => {
      builds++
      return Promise.reject(new Error('WGSL compile error'))
    }
    for (const id of ['broken', 'alsoBroken']) {
      await expect(
        getOrBuildPipeline(
          device,
          pipelineRecipe({ ...SPAN, id }, 'not wgsl', 4),
          build,
        ),
      ).rejects.toThrow('WGSL compile error')
    }
    expect(builds).toBe(1)
  })
})
