import { MockHal } from '@jbrowse/render-core/hal'

import { GpuVariantRenderer, VARIANT_PASSES } from './GpuVariantRenderer.ts'
import { INSTANCE_STRIDE_F32 as INSTANCE_STRIDE } from './shaders/variant.generated.ts'

import type {
  VariantRenderBlock,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

function makeUploadData(): VariantUploadData {
  return {
    cellPositions: new Uint32Array([100, 200, 300, 400]),
    cellRowIndices: new Uint32Array([0, 1]),
    // ABGR-packed u32 per cell (R=255 G=0 B=0 A=255) → 0xff0000ff;
    // (R=0 G=255 B=0 A=128) → 0x8000ff00
    cellColors: new Uint32Array([0xff0000ff, 0x8000ff00]),
    cellShapeTypes: new Uint8Array([0, 1]),
    numCells: 2,
  }
}

function makeBlock(
  overrides?: Partial<VariantRenderBlock>,
): VariantRenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: 10000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...overrides,
  }
}

const DEFAULT_STATE = {
  canvasWidth: 800,
  canvasHeight: 600,
  rowHeight: 20,
  scrollTop: 0,
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
    // first cell: start=100, end=200
    expect(u32[0]).toBe(100)
    expect(u32[1]).toBe(200)
    // row_index=0
    expect(u32[2]).toBe(0)
    // shape_type=0
    expect(u32[3]).toBe(0)
    // color ABGR packed (R=255, G=0, B=0, A=255) -> 0xFF0000FF
    expect(u32[4]).toBe(0xff0000ff)

    // second cell: start=300, end=400, row=1, shape=1
    const off = INSTANCE_STRIDE
    expect(u32[off]).toBe(300)
    expect(u32[off + 1]).toBe(400)
    expect(u32[off + 2]).toBe(1)
    expect(u32[off + 3]).toBe(1)
    // color ABGR packed (R=0, G=255, B=0, A=128) -> 0x8000FF00
    expect(u32[off + 4]).toBe(0x8000ff00)
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
    const data = makeUploadData()

    renderer.uploadRegion(0, data)
    renderer.renderBlocks([makeBlock()], new Map([[0, data]]), {
      ...DEFAULT_STATE,
      scrollTop: 50,
    })

    const methods = hal.calls.map(c => c.method)
    expect(methods.indexOf('resize')).toBeLessThan(
      methods.indexOf('beginFrame'),
    )
    expect(methods.indexOf('beginFrame')).toBeLessThan(
      methods.indexOf('drawPass'),
    )
    expect(methods.indexOf('drawPass')).toBeLessThan(
      methods.indexOf('endFrame'),
    )

    const f32 = hal.getLastUniformsF32()!
    // canvas_height at slot 3, row_height at slot 5, scroll_top at slot 6
    // (see UNIFORM_OFFSET_F32 in shaders/variant.generated.ts)
    expect(f32[3]).toBe(600)
    expect(f32[5]).toBe(20)
    expect(f32[6]).toBe(50)
  })

  it('prunes stale regions via hal.pruneRegions', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.uploadRegion(0, makeUploadData())
    renderer.uploadRegion(1, makeUploadData())
    renderer.uploadRegion(2, makeUploadData())

    renderer.pruneRegions([1])

    expect(hal.getBufferCount(0, 'main')).toBe(0)
    expect(hal.getBufferCount(1, 'main')).toBe(2)
    expect(hal.getBufferCount(2, 'main')).toBe(0)
  })

  it('skips blocks with no region in the map', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)

    renderer.renderBlocks(
      [makeBlock({ displayedRegionIndex: 99 })],
      new Map(),
      DEFAULT_STATE,
    )

    expect(hal.callsOf('drawPass').length).toBe(0)
  })

  it('renders multiple blocks', () => {
    const hal = new MockHal(VARIANT_PASSES)
    const renderer = new GpuVariantRenderer(hal)
    const data = makeUploadData()

    renderer.uploadRegion(0, data)
    renderer.uploadRegion(1, data)

    renderer.renderBlocks(
      [
        makeBlock({
          displayedRegionIndex: 0,
          screenStartPx: 0,
          screenEndPx: 400,
        }),
        makeBlock({
          displayedRegionIndex: 1,
          screenStartPx: 400,
          screenEndPx: 800,
        }),
      ],
      new Map([
        [0, data],
        [1, data],
      ]),
      DEFAULT_STATE,
    )

    expect(hal.callsOf('drawPass').length).toBe(2)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })
})
