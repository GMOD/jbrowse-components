import {
  getDeviceLayouts,
  getOrBuildPipeline,
  resetDeviceGpuCacheForTests,
} from './deviceGpuCache.ts'

import type { PipelineDescriptor } from './types.ts'

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

const pass = (id: string) => ({ id }) as PipelineDescriptor

describe('deviceGpuCache', () => {
  // A WebGPU-only global, so jsdom has none and the layout builder reads it at
  // call time. Nothing in the app reaches that code without a real device.
  const shaderStage = { VERTEX: 1, FRAGMENT: 2 }
  beforeAll(() => {
    Object.assign(globalThis, { GPUShaderStage: shaderStage })
  })
  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'GPUShaderStage')
  })

  it('builds one set of layouts per device, not per HAL', () => {
    const { device, calls } = fakeDevice()
    try {
      const first = getDeviceLayouts(device)
      const second = getDeviceLayouts(device)

      expect(second).toBe(first)
      // uniform-only + textured, and their two pipeline layouts
      expect(calls.bindGroupLayouts).toBe(2)
      expect(calls.pipelineLayouts).toBe(2)
    } finally {
      resetDeviceGpuCacheForTests(device)
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

  it('builds a descriptor once however many displays ask for it', async () => {
    const { device } = fakeDevice()
    const read = pass('read')
    let builds = 0
    const build = async () => {
      builds++
      return {} as GPURenderPipeline
    }
    try {
      // three displays of the same track type, handed the same module-level
      // descriptor object
      const [one, two, three] = await Promise.all([
        getOrBuildPipeline(device, read, build),
        getOrBuildPipeline(device, read, build),
        getOrBuildPipeline(device, read, build),
      ])

      expect(builds).toBe(1)
      expect(two).toBe(one)
      expect(three).toBe(one)
    } finally {
      resetDeviceGpuCacheForTests(device)
    }
  })

  it('dedupes concurrent asks, which is the case that actually happens', async () => {
    // Many tracks mount in one tick, so every WebGPUHal.create runs before any
    // of them finishes compiling. A memo that only recorded resolved pipelines
    // would miss on all of them.
    const { device } = fakeDevice()
    const read = pass('read')
    let builds = 0
    let release: (p: GPURenderPipeline) => void = () => {}
    const pending = new Promise<GPURenderPipeline>(resolve => {
      release = resolve
    })
    const build = () => {
      builds++
      return pending
    }
    try {
      const asks = [
        getOrBuildPipeline(device, read, build),
        getOrBuildPipeline(device, read, build),
      ]
      expect(builds).toBe(1)

      release({} as GPURenderPipeline)
      const [one, two] = await Promise.all(asks)
      expect(two).toBe(one)
    } finally {
      resetDeviceGpuCacheForTests(device)
    }
  })

  it('keeps two descriptors apart even when they share a shader module', () => {
    // MAF and multi-row both draw `rowRect.slang`, and each calls slangPass()
    // for it — so they hold distinct descriptor objects and must not collide.
    const { device } = fakeDevice()
    const mafRow = pass('rowRect')
    const multiRowRow = pass('rowRect')
    let builds = 0
    const build = async () => {
      builds++
      return {} as GPURenderPipeline
    }
    try {
      void getOrBuildPipeline(device, mafRow, build)
      void getOrBuildPipeline(device, multiRowRow, build)
      expect(builds).toBe(2)
    } finally {
      resetDeviceGpuCacheForTests(device)
    }
  })

  it('caches a compile failure rather than re-running it per display', async () => {
    const { device } = fakeDevice()
    const broken = pass('broken')
    let builds = 0
    const build = () => {
      builds++
      return Promise.reject(new Error('WGSL compile error'))
    }
    try {
      await expect(getOrBuildPipeline(device, broken, build)).rejects.toThrow(
        'WGSL compile error',
      )
      await expect(getOrBuildPipeline(device, broken, build)).rejects.toThrow(
        'WGSL compile error',
      )
      expect(builds).toBe(1)
    } finally {
      resetDeviceGpuCacheForTests(device)
    }
  })
})
