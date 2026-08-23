import { GpuHalBase } from './gpuHalBase.ts'

import type { PipelineDescriptor, TextureBinding } from './types.ts'

// The over-limit refusals are the part of the shared shells nothing else pins:
// `MockHal` has no limits, `webgpuHal*.test.ts` never uploads past one, and
// there is no WebGL2 unit test at all — the real ones only fail on a GPU large
// enough to reach them.
interface TestBuffer {
  id: number
  count: number
}

class TestHal extends GpuHalBase<TestBuffer> {
  created: TestBuffer[] = []
  destroyed: number[] = []
  textures: { passId: string; filter: string; width: number }[] = []
  released = 0
  maxBufferBytes = 1024
  maxTextureDimensionPx = 256

  private nextId = 0

  protected limits() {
    return {
      maxBufferBytes: this.maxBufferBytes,
      maxTextureDimensionPx: this.maxTextureDimensionPx,
    }
  }

  protected createBuffer(_data: ArrayBuffer | ArrayBufferView, count: number) {
    const buf = { id: this.nextId++, count }
    this.created.push(buf)
    return buf
  }

  protected destroyBuffer(buf: TestBuffer) {
    this.destroyed.push(buf.id)
  }

  protected createTexture(
    passId: string,
    binding: TextureBinding,
    _data: Uint8Array,
    width: number,
  ) {
    this.textures.push({ passId, filter: binding.filter, width })
  }

  protected releaseResources() {
    this.released++
  }
}

const textured = {
  id: 'ramp',
  textures: [{ filter: 'linear' }],
} as unknown as PipelineDescriptor

const plain = { id: 'rect' } as PipelineDescriptor

function makeHal() {
  const hal = new TestHal([plain, textured], 'TestHal')
  const errors: string[] = []
  hal.setErrorHandler(e => errors.push(e.message))
  return { hal, errors }
}

test('an upload replaces the pass buffer, destroying the one it replaces', () => {
  const { hal } = makeHal()
  hal.uploadBuffer(0, 'rect', new Uint8Array(8), 2)
  hal.uploadBuffer(0, 'rect', new Uint8Array(16), 4)

  expect(hal.getBufferCount(0, 'rect')).toBe(4)
  expect(hal.destroyed).toEqual([0])
})

test('an empty upload IS the release', () => {
  const { hal } = makeHal()
  hal.uploadBuffer(0, 'rect', new Uint8Array(8), 2)
  hal.uploadBuffer(0, 'rect', new Uint8Array(0), 0)

  expect(hal.getBufferCount(0, 'rect')).toBe(0)
  expect(hal.destroyed).toEqual([0])
  expect(hal.created).toHaveLength(1)
})

test('an over-limit buffer is refused, reported, and leaves nothing behind', () => {
  const { hal, errors } = makeHal()
  hal.uploadBuffer(0, 'rect', new Uint8Array(8), 2)
  hal.uploadBuffer(0, 'rect', new Uint8Array(2048), 4)

  // the prior buffer still goes: refusing the new one does not resurrect it
  expect(hal.getBufferCount(0, 'rect')).toBe(0)
  expect(hal.created).toHaveLength(1)
  expect(errors).toEqual([
    expect.stringContaining('vertex buffer 2048 bytes exceeds the 1024-byte'),
  ])
})

test('a texture upload reaches the leaf with the pass binding', () => {
  const { hal } = makeHal()
  hal.uploadTexture('ramp', new Uint8Array(1024), 256, 1)

  expect(hal.textures).toEqual([
    { passId: 'ramp', filter: 'linear', width: 256 },
  ])
})

test('a pass with no texture binding is answered without touching the leaf', () => {
  const { hal, errors } = makeHal()
  hal.uploadTexture('rect', new Uint8Array(1024), 256, 1)
  hal.uploadTexture('nonexistent', new Uint8Array(1024), 256, 1)

  expect(hal.textures).toEqual([])
  expect(errors).toEqual([])
})

test('an over-limit texture is refused and reported', () => {
  const { hal, errors } = makeHal()
  hal.uploadTexture('ramp', new Uint8Array(4), 512, 1)

  expect(hal.textures).toEqual([])
  expect(errors).toEqual([
    expect.stringContaining('texture 512×1 exceeds max texture size 256'),
  ])
})

test('deleteRegion and pruneRegions destroy through the leaf hook', () => {
  const { hal } = makeHal()
  hal.uploadBuffer(0, 'rect', new Uint8Array(8), 1)
  hal.uploadBuffer(1, 'rect', new Uint8Array(8), 1)
  hal.uploadBuffer(2, 'rect', new Uint8Array(8), 1)

  hal.deleteRegion(0)
  hal.pruneRegions([2])

  expect(hal.destroyed).toEqual([0, 1])
  expect(hal.getBufferCount(2, 'rect')).toBe(1)
})

test('dispose releases once however many times it is called', () => {
  const { hal } = makeHal()
  hal.dispose()
  hal.dispose()

  expect(hal.released).toBe(1)
})
