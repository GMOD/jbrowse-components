import { MockHal } from './hal/mockHal.ts'
import {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from './perRegionRenderingBackend.ts'

import type { BlockClipResult } from './blockClipUtils.ts'
import type { PipelineDescriptor } from './hal/types.ts'
import type { InstancePass } from './instancePass.ts'
import type { FrameDimensions } from './perRegionRenderingBackend.ts'
import type { RenderBlock } from './renderBlock.ts'

// `renderBlocks` answers whether real content reached the canvas, and
// RenderLifecycleMixin flips `canvasDrawn` — the loading scrim, the `-done`
// testid, every browser test's wait — only on true. A backend that answers true
// over an empty canvas strands the scrim's inverse: a display asserting doneness
// with nothing painted, which unit tests downstream can't see and screenshot
// capture silently records as a blank PNG.

interface Data {
  value: number
}

const STATE: FrameDimensions = { canvasWidth: 800, canvasHeight: 100 }

function block(displayedRegionIndex: number, over: Partial<RenderBlock> = {}) {
  return {
    displayedRegionIndex,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...over,
  }
}

class TestGpuBackend extends GpuPerRegionRenderingBackend<
  Data,
  FrameDimensions
> {
  drawn: number[] = []
  protected regionPasses = []

  protected drawRegion(
    b: RenderBlock,
    _clip: BlockClipResult,
    _region: Data,
    _state: FrameDimensions,
  ) {
    this.drawn.push(b.displayedRegionIndex)
  }
}

class TestCanvas2DBackend extends Canvas2DPerRegionRenderingBackend<
  Data,
  FrameDimensions
> {
  drawCalls = 0

  protected draw() {
    this.drawCalls++
  }
}

// Same scaffold, but it actually issues a draw, so `hal.draws()` can report the
// clip each block went out under.
class DrawingGpuBackend extends GpuPerRegionRenderingBackend<
  Data,
  FrameDimensions
> {
  protected regionPasses = []

  protected drawRegion(b: RenderBlock) {
    this.hal.drawPass('rect', b.displayedRegionIndex)
  }
}

function gpuBackend() {
  return new TestGpuBackend(new MockHal([]), 256)
}

function canvas2dBackend() {
  return new TestCanvas2DBackend(document.createElement('canvas'))
}

describe('GpuPerRegionRenderingBackend.renderBlocks paint reporting', () => {
  test('true when a block drew its region', () => {
    const b = gpuBackend()
    expect(
      b.renderBlocks([block(0)], new Map([[0, { value: 1 }]]), STATE),
    ).toBe(true)
    expect(b.drawn).toEqual([0])
  })

  test('false when no region data has arrived yet', () => {
    const b = gpuBackend()
    expect(b.renderBlocks([block(0)], new Map(), STATE)).toBe(false)
    expect(b.drawn).toEqual([])
  })

  test('false when there are no blocks to draw', () => {
    const b = gpuBackend()
    expect(b.renderBlocks([], new Map([[0, { value: 1 }]]), STATE)).toBe(false)
  })

  test('false when every block clips fully offscreen', () => {
    const b = gpuBackend()
    const offscreen = block(0, { screenStartPx: -400, screenEndPx: -100 })
    expect(
      b.renderBlocks([offscreen], new Map([[0, { value: 1 }]]), STATE),
    ).toBe(false)
    expect(b.drawn).toEqual([])
  })

  test('true when only some blocks have data', () => {
    const b = gpuBackend()
    const blocks = [
      block(0, { screenStartPx: 0, screenEndPx: 400 }),
      block(1, { screenStartPx: 400, screenEndPx: 800 }),
    ]
    expect(b.renderBlocks(blocks, new Map([[1, { value: 1 }]]), STATE)).toBe(
      true,
    )
    expect(b.drawn).toEqual([1])
  })

  test('a region present but empty still counts as painted', () => {
    // An in-view region that fetched zero features is a real frame: the display
    // is done, it just has nothing to show. Gating on feature count instead of
    // region presence would hang the scrim over an empty region forever.
    const b = gpuBackend()
    expect(
      b.renderBlocks([block(0)], new Map([[0, { value: 0 }]]), STATE),
    ).toBe(true)
  })

  test('frame is always paired, even when nothing painted', () => {
    const hal = new MockHal([])
    const b = new TestGpuBackend(hal, 256)
    expect(b.renderBlocks([block(0)], new Map(), STATE)).toBe(false)
    const methods = hal.calls.map(c => c.method)
    expect(methods).toContain('beginFrame')
    expect(methods).toContain('endFrame')
  })
})

describe('Canvas2DPerRegionRenderingBackend.renderBlocks paint reporting', () => {
  // Canvas2D answers "some block had region data" — it delegates clipping to the
  // plugin's drawXxxBlocks, so it can't see the offscreen case the GPU base can.
  // Every other answer matches, which is what the differential backend run
  // relies on.
  test('true when a block has region data', () => {
    const b = canvas2dBackend()
    expect(
      b.renderBlocks([block(0)], new Map([[0, { value: 1 }]]), STATE),
    ).toBe(true)
    expect(b.drawCalls).toBe(1)
  })

  test('false when no region data has arrived yet', () => {
    const b = canvas2dBackend()
    expect(b.renderBlocks([block(0)], new Map(), STATE)).toBe(false)
  })

  test('false when there are no blocks to draw', () => {
    const b = canvas2dBackend()
    expect(b.renderBlocks([], new Map([[0, { value: 1 }]]), STATE)).toBe(false)
  })

  test('draw still runs when nothing painted, so the canvas clears', () => {
    const b = canvas2dBackend()
    b.renderBlocks([block(0)], new Map(), STATE)
    expect(b.drawCalls).toBe(1)
  })

  test('agrees with the GPU base on the cases both can see', () => {
    const cases: [RenderBlock[], Map<number, Data>][] = [
      [[block(0)], new Map([[0, { value: 1 }]])],
      [[block(0)], new Map()],
      [[], new Map([[0, { value: 1 }]])],
      [[block(0), block(1)], new Map([[1, { value: 1 }]])],
    ]
    for (const [blocks, regions] of cases) {
      expect(canvas2dBackend().renderBlocks(blocks, regions, STATE)).toBe(
        gpuBackend().renderBlocks(blocks, regions, STATE),
      )
    }
  })
})

// `upload` is the base's too, driven by each backend's `regionPasses`.
// What the six hand-written versions it replaced all had to get right — and
// each spelled differently — is that a pass whose data went empty must not keep
// drawing its last buffer. The base gets that from the HAL rather than from a
// guard of its own: an empty pack IS the release, so a multi-pass backend
// clears exactly the passes that emptied.
describe('GpuPerRegionRenderingBackend.upload', () => {
  const STRIDE = 8

  function countingPass(
    id: string,
    instances: (d: Data) => number,
  ): InstancePass<Data> {
    return {
      id,
      wgslSource: '',
      glslVertex: '',
      glslFragment: '',
      instanceStride: STRIDE,
      verticesPerInstance: 6,
      blend: true,
      vertexAttributes: [],
      pack: d => new ArrayBuffer(instances(d) * STRIDE),
    }
  }

  class TwoPassBackend extends GpuPerRegionRenderingBackend<
    Data,
    FrameDimensions
  > {
    // `b` empties one step before `a` does, so the two can be told apart.
    protected regionPasses = [
      countingPass('a', d => d.value),
      countingPass('b', d => (d.value > 1 ? 1 : 0)),
    ]

    protected drawRegion() {}
  }

  function counts(hal: MockHal) {
    return [hal.getBufferCount(0, 'a'), hal.getBufferCount(0, 'b')]
  }

  function backend() {
    const hal = new MockHal([])
    return { hal, b: new TwoPassBackend(hal, 256) }
  }

  test('each pass gets as many instances as its packed bytes hold', () => {
    const { hal, b } = backend()
    b.upload(0, { value: 3 })
    expect(counts(hal)).toEqual([3, 1])
  })

  test('a pass that empties releases its buffer; its siblings keep theirs', () => {
    const { hal, b } = backend()
    b.upload(0, { value: 3 })
    b.upload(0, { value: 1 })
    expect(counts(hal)).toEqual([1, 0])
  })

  test('a region that empties holds no buffers', () => {
    const { hal, b } = backend()
    b.upload(0, { value: 3 })
    b.upload(0, { value: 0 })
    expect(counts(hal)).toEqual([0, 0])
  })
})

// The scaffold sets a scissor and viewport per block and clears both after the
// loop. Those are HAL *state*, so a call log cannot say which columns a given
// block's draw actually landed in — `hal.draws()` carries the clip in force at
// each one (see MockHal).
describe('GpuPerRegionRenderingBackend.renderBlocks block clipping', () => {
  function drawingBackend() {
    const hal = new MockHal([{ id: 'rect' } as unknown as PipelineDescriptor])
    return { hal, b: new DrawingGpuBackend(hal, 256) }
  }

  test('each block draws clipped to its own columns', () => {
    const { hal, b } = drawingBackend()
    const blocks = [
      block(0, { screenStartPx: 0, screenEndPx: 400 }),
      block(1, { screenStartPx: 400, screenEndPx: 800 }),
    ]
    b.renderBlocks(
      blocks,
      new Map([
        [0, { value: 1 }],
        [1, { value: 1 }],
      ]),
      STATE,
    )

    // dpr is 1 in jsdom, so CSS px and device px coincide
    expect(hal.draws().map(d => [d.regionKey, d.scissor])).toEqual([
      [0, { x: 0, y: 0, w: 400, h: 100 }],
      [1, { x: 400, y: 0, w: 400, h: 100 }],
    ])
  })

  test('a block is clipped to the canvas, not to its own span', () => {
    // A block hanging off the right edge must not scissor past the backing
    // store — WebGPU rejects an out-of-bounds rect and blanks the whole frame.
    const { hal, b } = drawingBackend()
    b.renderBlocks(
      [block(0, { screenStartPx: 600, screenEndPx: 1400 })],
      new Map([[0, { value: 1 }]]),
      STATE,
    )

    expect(hal.draws()[0]!.scissor).toEqual({ x: 600, y: 0, w: 200, h: 100 })
  })

  test('the frame ends with the clip released', () => {
    // Not observable on a draw, since nothing draws after — assert the calls.
    // A frame that left a scissor set would clip whatever the next one begins
    // with on a HAL that does not reset in beginFrame.
    const { hal, b } = drawingBackend()
    b.renderBlocks([block(0)], new Map([[0, { value: 1 }]]), STATE)

    const methods = hal.calls.map(c => c.method)
    expect(methods.slice(-3)).toEqual([
      'clearScissor',
      'clearViewport',
      'endFrame',
    ])
  })
})
