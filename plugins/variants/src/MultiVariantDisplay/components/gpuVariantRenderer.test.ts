import { MockHal } from '@jbrowse/core/gpu/hal'

import { GpuVariantRenderer, VARIANT_PASSES } from './GpuVariantRenderer.ts'
import { INSTANCE_STRIDE } from './variantShaders.ts'

import type { VariantRenderBlock } from './variantBackendTypes.ts'

beforeAll(() => {
  ;(globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 }
})

afterAll(() => {
  delete (globalThis as Record<string, unknown>).window
})

function makeUploadData() {
  return {
    regionStart: 5000,
    cellPositions: new Uint32Array([100, 200, 300, 400]),
    cellRowIndices: new Uint32Array([0, 1]),
    cellColors: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]),
    cellShapeTypes: new Uint8Array([0, 1]),
    numCells: 2,
  }
}

function makeBlock(overrides?: Partial<VariantRenderBlock>): VariantRenderBlock {
  return {
    regionNumber: 0,
    bpRangeX: [0, 10000],
    screenStartPx: 0,
    screenEndPx: 800,
    ...overrides,
  }
}

describe('GpuVariantRenderer', () => {
  it('uploads interleaved cell data', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())

    const buf = hal.getBuffer(0, 'main')
    expect(buf).toBeDefined()
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * INSTANCE_STRIDE * 4)

    const u32 = new Uint32Array(buf!.data)
    const f32 = new Float32Array(buf!.data)
    // first cell: start=100, end=200
    expect(u32[0]).toBe(100)
    expect(u32[1]).toBe(200)
    // row_index=0
    expect(u32[2]).toBe(0)
    // shape_type=0
    expect(u32[3]).toBe(0)
    // color: r=255/255=1.0
    expect(f32[4]).toBeCloseTo(1.0)

    // second cell: start=300, end=400, row=1, shape=1
    const off = INSTANCE_STRIDE
    expect(u32[off]).toBe(300)
    expect(u32[off + 1]).toBe(400)
    expect(u32[off + 2]).toBe(1)
    expect(u32[off + 3]).toBe(1)
    // green: 255/255=1.0
    expect(f32[off + 5]).toBeCloseTo(1.0)
    // alpha: 128/255
    expect(f32[off + 7]).toBeCloseTo(128 / 255)
  })

  it('deletes region on empty upload', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())
    renderer.uploadRegion(0, { ...makeUploadData(), numCells: 0 })

    expect(hal.getBufferCount(0, 'main')).toBe(0)
    expect(hal.callsOf('deleteRegion').length).toBe(1)
  })

  it('renders with correct frame lifecycle and uniforms', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())

    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 600,
      rowHeight: 20,
      scrollTop: 50,
    })

    const methods = hal.calls.map(c => c.method)
    expect(methods.indexOf('resize')).toBeLessThan(methods.indexOf('beginFrame'))
    expect(methods.indexOf('beginFrame')).toBeLessThan(methods.indexOf('drawPass'))
    expect(methods.indexOf('drawPass')).toBeLessThan(methods.indexOf('endFrame'))

    const f32 = hal.getLastUniformsF32()!
    const u32 = hal.getLastUniformsU32()!
    // region_start at slot 3
    expect(u32[3]).toBe(5000)
    // canvas_height at slot 4
    expect(f32[4]).toBe(600)
    // row_height at slot 6
    expect(f32[6]).toBe(20)
    // scroll_top at slot 7
    expect(f32[7]).toBe(50)
  })

  it('prunes stale regions', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())
    renderer.uploadRegion(1, makeUploadData())
    renderer.uploadRegion(2, makeUploadData())

    renderer.pruneStaleRegions([1])

    expect(hal.getBufferCount(0, 'main')).toBe(0)
    expect(hal.getBufferCount(1, 'main')).toBe(2)
    expect(hal.getBufferCount(2, 'main')).toBe(0)
  })

  it('skips blocks with no buffer', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.renderBlocks([makeBlock({ regionNumber: 99 })], {
      canvasWidth: 800,
      canvasHeight: 600,
      rowHeight: 20,
      scrollTop: 0,
    })

    expect(hal.callsOf('drawPass').length).toBe(0)
  })

  it('renders multiple blocks', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())
    renderer.uploadRegion(1, makeUploadData())

    renderer.renderBlocks(
      [
        makeBlock({ regionNumber: 0, screenStartPx: 0, screenEndPx: 400 }),
        makeBlock({ regionNumber: 1, screenStartPx: 400, screenEndPx: 800 }),
      ],
      {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 20,
        scrollTop: 0,
      },
    )

    expect(hal.callsOf('drawPass').length).toBe(2)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })
})
