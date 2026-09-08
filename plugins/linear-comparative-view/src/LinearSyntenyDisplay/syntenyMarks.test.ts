import { MockHal } from '@jbrowse/render-core/hal'
import {
  Canvas2DMarkBackend,
  GpuMarkBackend,
} from '@jbrowse/render-core/marks/backend'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import {
  KIND_BASE,
  KIND_CIGAR_I,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  INSTANCE_STRIDE_BYTES,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/syntenyFillStraight.generated.ts'
import { SYNTENY_MARKS } from './syntenyMarks.ts'
import { createSyntenyPicker } from './syntenyPickEngine.ts'
import { syntenyGroundClear } from './syntenyRibbonMarks.ts'
import { stubPickCtx } from './testUtils.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  SyntenyCell,
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

const SYNTENY_PASSES = SYNTENY_MARKS.map(m => m.pass)

// Window-relative corner bp (base0/base1 = 0 in these fixtures, so these equal
// cumBp).
function bpArr(values: number[]) {
  return Float32Array.from(values)
}

function makeInstanceData(
  count = 1,
  overrides?: Partial<SyntenyInstanceData>,
): SyntenyInstanceData {
  return {
    bp1: bpArr(Array.from({ length: count }, () => 10)),
    bp2: bpArr(Array.from({ length: count }, () => 100)),
    bp3: bpArr(Array.from({ length: count }, () => 110)),
    bp4: bpArr(Array.from({ length: count }, () => 20)),
    base0: 0,
    base1: 0,
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    alignmentLengths: new Float32Array(count).fill(10000),
    instanceCount: count,
    ...overrides,
  }
}

function makeParams(
  overrides?: Partial<SyntenyTrackRenderParams>,
): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: 100,
    alpha: 1,
    fadeThinAlignments: true,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    ...overrides,
  }
}

function makeState(
  perTrack: [number, SyntenyTrackRenderParams][],
  {
    overdrawPx = 300,
    canvasWidth = 800,
    canvasHeight = 100,
    groundColor = '#fff',
  } = {},
): SyntenyRenderState {
  return {
    canvasWidth,
    canvasHeight,
    overdrawPx,
    groundColor,
    perTrack: new Map(perTrack),
  }
}

// A track's two cells under the two keys the level uploads them as: `key` for
// its ribbons and `key + 1` for the outline of whichever ribbon is selected.
function cellsFor(
  entries: [number, SyntenyInstanceData][],
  clickedFeatureId = 0,
) {
  const cells = new Map<number, SyntenyCell>()
  for (const [key, data] of entries) {
    cells.set(key, { kind: 'ribbons', data })
    if (clickedFeatureId > 0) {
      cells.set(key + 1, { kind: 'outline', data, featureId: clickedFeatureId })
    }
  }
  return cells
}

function outlineParams(
  perTrack: [number, SyntenyTrackRenderParams][],
): [number, SyntenyTrackRenderParams][] {
  return perTrack.flatMap(([key, params]) => [
    [key, params],
    [key + 1, params],
  ])
}

// ---------------------------------------------------------------- Canvas2D --

function createMockCanvas() {
  const pathOps: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    // `withClip` opens each block's clip as beginPath+rect+clip, so dropping
    // the beginPath it just pushed leaves `pathOps` the shapes' own ops alone
    rect: jest.fn(() => pathOps.pop()),
    clip: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn((x: number, y: number) =>
      pathOps.push(`moveTo(${x.toFixed(1)},${y.toFixed(1)})`),
    ),
    lineTo: jest.fn((x: number, y: number) =>
      pathOps.push(`lineTo(${x.toFixed(1)},${y.toFixed(1)})`),
    ),
    bezierCurveTo: jest.fn(
      (
        cp1x: number,
        cp1y: number,
        cp2x: number,
        cp2y: number,
        x: number,
        y: number,
      ) =>
        pathOps.push(
          `bezierCurveTo(${cp1x.toFixed(1)},${cp1y.toFixed(1)},${cp2x.toFixed(1)},${cp2y.toFixed(1)},${x.toFixed(1)},${y.toFixed(1)})`,
        ),
    ),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    stroke: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, pathOps }
}

// The Canvas2D frame the fallback backend and the SVG export both run: the mark
// list over the level's cells, blocked one canvas-wide clip per cell.
function paintFrame(
  cells: ReadonlyMap<number, SyntenyCell>,
  state: SyntenyRenderState,
) {
  const mock = createMockCanvas()
  mock.canvas.width = state.canvasWidth
  mock.canvas.height = state.canvasHeight
  const backend = new Canvas2DMarkBackend(mock.canvas, SYNTENY_MARKS, s =>
    syntenyGroundClear(s.groundColor),
  )
  const painted = backend.renderBlocks(
    canvasWideBlocks(cells.keys(), state.canvasWidth),
    cells,
    state,
  )
  return { ...mock, painted }
}

function fills(pathOps: string[]) {
  return pathOps.filter(op => op === 'fill').length
}

describe('the ribbon painter, through the mark list', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })
  })

  test('a straight feature is one closed parallelogram', () => {
    const { pathOps } = paintFrame(
      cellsFor([[0, makeInstanceData()]]),
      makeState([[0, makeParams()]]),
    )
    expect(fills(pathOps)).toBe(1)
    expect(pathOps.filter(op => op === 'closePath')).toHaveLength(1)
  })

  test('yTop is baked into the draw coordinates, not the canvas transform', () => {
    // Regression: the SVG-export raster pre-scales the canvas via ctx.scale(dpr),
    // so drawSyntenyTrack must NOT own the transform (a setTransform there
    // clobbered the raster scale and rendered the ribbon at half size). It draws
    // in logical coords with yTop folded into the y values instead.
    const { pathOps } = paintFrame(
      cellsFor([[0, makeInstanceData()]]),
      makeState([[0, makeParams({ yTop: 100, height: 100 })]], {
        canvasHeight: 300,
      }),
    )
    const ys = pathOps
      .filter(op => op.startsWith('moveTo') || op.startsWith('lineTo'))
      .map(op => Number(/,([\d.]+)\)/.exec(op)![1]))
    expect(Math.min(...ys)).toBeCloseTo(100)
    expect(Math.max(...ys)).toBeCloseTo(200)
  })

  test('curve mode traces native cubic beziers', () => {
    const { pathOps } = paintFrame(
      cellsFor([[0, makeInstanceData()]]),
      makeState([[0, makeParams({ drawCurves: true })]]),
    )
    expect(pathOps.filter(op => op.startsWith('bezierCurveTo'))).toHaveLength(2)
  })

  test('a feature below minAlignmentLength draws nothing', () => {
    const { pathOps } = paintFrame(
      cellsFor([
        [0, makeInstanceData(1, { alignmentLengths: new Float32Array([100]) })],
      ]),
      makeState([[0, makeParams({ minAlignmentLength: 500 })]]),
    )
    expect(fills(pathOps)).toBe(0)
  })

  test('a zero-alpha feature draws nothing', () => {
    const { pathOps } = paintFrame(
      cellsFor([
        [0, makeInstanceData(1, { colors: new Uint32Array([0x00808080]) })],
      ]),
      makeState([[0, makeParams()]]),
    )
    expect(fills(pathOps)).toBe(0)
  })

  test('a hull entirely off-canvas inside the overdraw band is culled', () => {
    // 900px left of the canvas but well inside overdrawPx=1000, so the per-edge
    // cull keeps it; its four corners are all off-canvas, so it cannot paint a
    // pixel and the hull cull drops it. Regression: the SVG export serialized
    // ~60% of its <path> elements entirely outside the level's clip rect.
    const { pathOps } = paintFrame(
      cellsFor([
        [
          0,
          makeInstanceData(1, {
            bp1: bpArr([-950]),
            bp2: bpArr([-900]),
            bp3: bpArr([-880]),
            bp4: bpArr([-930]),
          }),
        ],
      ]),
      makeState([[0, makeParams()]], { overdrawPx: 1000 }),
    )
    expect(fills(pathOps)).toBe(0)
  })

  test('a ribbon that only reaches the canvas at one end is kept', () => {
    const { pathOps } = paintFrame(
      cellsFor([
        [
          0,
          makeInstanceData(1, {
            bp1: bpArr([-950]),
            bp2: bpArr([-900]),
            bp3: bpArr([400]),
            bp4: bpArr([350]),
          }),
        ],
      ]),
      makeState([[0, makeParams()]], { overdrawPx: 1000 }),
    )
    expect(fills(pathOps)).toBe(1)
  })

  test('a feature outside the viewport is culled', () => {
    const { pathOps } = paintFrame(
      cellsFor([
        [
          0,
          makeInstanceData(1, {
            bp1: bpArr([5000]),
            bp2: bpArr([6000]),
            bp3: bpArr([6000]),
            bp4: bpArr([5000]),
          }),
        ],
      ]),
      makeState([[0, makeParams()]]),
    )
    expect(fills(pathOps)).toBe(0)
  })

  // The clicked outline is the one thing the two backends draw from different
  // places: `drawSyntenyTrack` strokes it inside its own loop, where it already
  // holds the corners and the fill/stroke verdict, while the GPU runs a pass of
  // its own over an outline cell. So the Canvas2D frame carries no outline cell
  // at all and still draws the outline.
  test('the clicked ribbon is outlined on its two connecting edges only', () => {
    const { pathOps } = paintFrame(
      cellsFor([[0, makeInstanceData()]], 1),
      makeState(outlineParams([[0, makeParams({ clickedFeatureId: 1 })]])),
    )
    const outline = pathOps.slice(pathOps.indexOf('fill') + 1)
    expect(outline).toEqual([
      'beginPath',
      'moveTo(10.0,0.0)',
      'lineTo(20.0,100.0)',
      'moveTo(100.0,0.0)',
      'lineTo(110.0,100.0)',
    ])
    expect(outline).not.toContain('closePath')
  })

  function strokeAlphasAt(
    data: Partial<SyntenyInstanceData>,
    params?: Partial<SyntenyTrackRenderParams>,
  ) {
    const alphas: number[] = []
    const cells = cellsFor([[0, makeInstanceData(1, data)]])
    const state = makeState([[0, makeParams(params)]])
    const mock = createMockCanvas()
    mock.canvas.width = 800
    mock.canvas.height = 100
    mock.ctx.stroke = jest.fn(() => {
      const m = /rgba\(\d+,\d+,\d+,([\d.]+)\)/.exec(mock.ctx.strokeStyle)
      if (m) {
        alphas.push(+m[1]!)
      }
    })
    new Canvas2DMarkBackend(mock.canvas, SYNTENY_MARKS).renderBlocks(
      canvasWideBlocks(cells.keys(), state.canvasWidth),
      cells,
      state,
    )
    return alphas
  }

  // vertical ribbon (top & bottom centred at 10.25 → slope 0, perpFactor 1),
  // 0.5px wide on both ends → perpW 0.5
  const subPixel = {
    bp1: bpArr([10]),
    bp2: bpArr([10.5]),
    bp3: bpArr([10.5]),
    bp4: bpArr([10]),
    colors: new Uint32Array([0x80808080]),
  }

  test('a sub-pixel BASE ribbon fades its stroke alpha by on-screen width', () => {
    const alphas = strokeAlphasAt(subPixel)
    expect(alphas).toHaveLength(1)
    expect(alphas[0]!).toBeCloseTo((0x80 / 255) * 0.5, 3)
  })

  test('fadeThinAlignments=false keeps full alpha regardless of width', () => {
    const alphas = strokeAlphasAt(subPixel, { fadeThinAlignments: false })
    expect(alphas).toHaveLength(1)
    expect(alphas[0]!).toBeCloseTo(0x80 / 255, 3)
  })

  test('a steep thin diagonal strokes its centerline rather than filling a sliver', () => {
    // 2px wide horizontally on both ends, but the centerline shifts 100→500 over
    // height 100 (slope 4 → perpFactor ~4.12), so perpendicular width ~0.49px.
    // A horizontal-width test would have filled a ragged sliver here.
    const { pathOps } = paintFrame(
      cellsFor([
        [
          0,
          makeInstanceData(1, {
            bp1: bpArr([100]),
            bp2: bpArr([102]),
            bp3: bpArr([502]),
            bp4: bpArr([500]),
          }),
        ],
      ]),
      makeState([[0, makeParams()]]),
    )
    expect(fills(pathOps)).toBe(0)
    expect(pathOps).toContain('moveTo(101.0,0.0)')
    expect(pathOps).toContain('lineTo(501.0,100.0)')
  })

  // A location-marker tick: one point per view, drawn as a 1px centerline. The
  // travel cap that decides whether it is worth drawing has to be answered
  // against the LIVE pan, because how far the tick travels is how far the two
  // views sit apart — and the worker that emits it cannot know that. It used to
  // be answered at fetch time, and the two views drift by up to a pan buffer
  // (wider than a view) before the fetch key rolls over, so panning one row
  // alone left every near-horizontal tick on screen: the shape
  // `hg002_haplotypes_location_markers` was denied for. Both frames below draw
  // the same uploaded geometry.
  function markerAtPan(offsetPx1: number) {
    return paintFrame(
      cellsFor([
        [
          0,
          makeInstanceData(1, {
            bp1: bpArr([100]),
            bp2: bpArr([100]),
            bp3: bpArr([500]),
            bp4: bpArr([500]),
            kinds: new Uint8Array([KIND_MARKER]),
          }),
        ],
      ]),
      makeState([[0, makeParams({ offsetPx1 })]]),
    ).pathOps
  }

  test('a marker tick within a view width of travel is drawn', () => {
    expect(markerAtPan(0)).toStrictEqual([
      'beginPath',
      'moveTo(100.0,0.0)',
      'lineTo(500.0,100.0)',
    ])
  })

  test('panning one view alone past the travel cap drops the tick', () => {
    // The bottom view alone moves 500px left, taking the tick's bottom end to
    // 1000 and its travel to 900 — past the 800px view width. The hull is
    // untouched (the top end is still mid-canvas), so this is the cap talking.
    expect(markerAtPan(-500)).toStrictEqual([])
  })

  test('a frame with no cells repaints the ground over the last one', () => {
    // A level whose only synteny track is hidden renders zero cells — that
    // repaint is what erases them, since Canvas2D keeps the last frame
    // otherwise (unlike WebGL, whose drawing buffer is discarded).
    const { ctx, pathOps } = paintFrame(new Map(), makeState([]))
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 100)
    expect(fills(pathOps)).toBe(0)
  })

  test('the ground is the state groundColor, not transparent', () => {
    const { ctx } = paintFrame(
      new Map(),
      makeState([], { groundColor: '#fff' }),
    )
    expect(ctx.fillStyle).toBe('rgba(255,255,255,1)')
  })

  test('each track paints its own cell', () => {
    const { pathOps } = paintFrame(
      cellsFor([
        [0, makeInstanceData()],
        [10, makeInstanceData()],
      ]),
      makeState(
        [
          [0, makeParams({ yTop: 0, height: 100 })],
          [10, makeParams({ yTop: 100, height: 100 })],
        ],
        { canvasHeight: 200 },
      ),
    )
    expect(fills(pathOps)).toBe(2)
  })
})

// --------------------------------------------------------------------- GPU --

function gpuFrame(
  cells: ReadonlyMap<number, SyntenyCell>,
  state: SyntenyRenderState,
  hal = new MockHal(SYNTENY_PASSES),
) {
  const backend = new GpuMarkBackend(hal, SYNTENY_MARKS, s =>
    syntenyGroundClear(s.groundColor),
  )
  for (const [key, cell] of cells) {
    backend.upload(key, cell)
  }
  const render = (s = state, c = cells) =>
    backend.renderBlocks(canvasWideBlocks(c.keys(), s.canvasWidth), c, s)
  render()
  return { hal, backend, render }
}

describe('the ribbon marks on the GPU', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })
  })

  test('one uploaded buffer serves both fill modes', () => {
    const data = makeInstanceData(3)
    const cells = cellsFor([[0, data]])
    const { hal, render } = gpuFrame(cells, makeState([[0, makeParams()]]))
    const uploads = hal.callsOf('uploadBuffer').length
    hal.calls = []

    render(makeState([[0, makeParams({ drawCurves: true })]]))

    // the mode is a uniform and a different pass, not a second upload
    expect(hal.callsOf('uploadBuffer')).toEqual([])
    expect(hal.callsOf('drawPass').map(c => c.args)).toEqual([
      ['fillCurve', 0, 'fillStraight'],
    ])
    // fillStraight owns the buffer; the other three marks pack nothing for a
    // ribbons cell or borrow it
    expect(uploads).toBe(2)
    expect(hal.getBufferCount(0, 'fillStraight')).toBe(3)
  })

  test('straight mode draws the straight pass off its own buffer', () => {
    const { hal } = gpuFrame(
      cellsFor([[0, makeInstanceData()]]),
      makeState([[0, makeParams()]]),
    )
    expect(hal.callsOf('drawPass').map(c => c.args)).toEqual([
      ['fillStraight', 0, undefined],
    ])
  })

  test('the frame clears to the band ground rather than transparent', () => {
    const { hal } = gpuFrame(new Map(), makeState([]))
    expect(hal.callsOf('beginFrame').map(c => c.args)).toEqual([[1, 1, 1, 1]])
  })

  test('a dark band clears to its own colour', () => {
    const { hal } = gpuFrame(
      new Map(),
      makeState([], { groundColor: '#121212' }),
    )
    const [r, g, b, a] = hal.callsOf('beginFrame')[0]!.args as number[]
    expect([r, g, b, a]).toEqual([18 / 255, 18 / 255, 18 / 255, 1])
  })

  test('an empty frame paints the ground with no draw calls', () => {
    // What a level with no synteny display left asks for. The repaint is what
    // erases the departed track, so it must not be skipped.
    const { hal } = gpuFrame(new Map(), makeState([]))
    expect(hal.callsOf('drawPass')).toEqual([])
    expect(hal.calls.map(c => c.method)).toContain('endFrame')
  })

  describe('the clicked outline', () => {
    // Two features, three instances: feature 1's base + CIGAR tile, feature 2's
    // base. Only the first is a clicked-outline silhouette.
    function clickable() {
      return makeInstanceData(3, {
        kinds: Uint8Array.from([KIND_BASE, KIND_CIGAR_I, KIND_BASE]),
        instanceFeatureIdx: Uint32Array.from([0, 0, 1]),
      })
    }

    // The regression the dedicated buffer exists for: the edge pass used to be
    // drawn against the fill pass's buffer, so it ran the vertex shader over
    // every instance in the region to outline one ribbon. It now gets a cell of
    // its own holding just that ribbon.
    test('draws the edge pass against a one-instance buffer of its own', () => {
      const { hal } = gpuFrame(
        cellsFor([[0, clickable()]], 1),
        makeState(outlineParams([[0, makeParams({ clickedFeatureId: 1 })]])),
      )
      expect(hal.getBufferCount(0, 'fillStraight')).toBe(3)
      expect(hal.getBufferCount(1, 'edgeStraight')).toBe(1)
      expect(hal.callsOf('drawPass').map(c => c.args)).toEqual([
        ['fillStraight', 0, undefined],
        ['edgeStraight', 1, undefined],
      ])
    })

    // The BACKEND half only: this re-renders with the same `cells` map, so what
    // it says is that a frame uploads nothing on its own. Whether a pan moves
    // the cell in the first place is a question about the model's getters, and
    // it belongs to `outlineUploadSchedule.test.ts` — this test carried the
    // name for both and checked one of them.
    test('a frame re-renders an unchanged cell without re-uploading it', () => {
      const cells = cellsFor([[0, clickable()]], 1)
      const params = makeParams({ clickedFeatureId: 1 })
      const { hal, render } = gpuFrame(
        cells,
        makeState(outlineParams([[0, params]])),
      )
      hal.calls = []

      render(
        makeState(outlineParams([[0, { ...params, offsetPx0: 40 }]])),
        cells,
      )

      expect(hal.callsOf('uploadBuffer')).toEqual([])
    })

    test('a new selection repacks the outline and nothing else', () => {
      const data = clickable()
      const { hal, backend } = gpuFrame(
        cellsFor([[0, data]], 1),
        makeState(outlineParams([[0, makeParams({ clickedFeatureId: 1 })]])),
      )
      hal.calls = []

      // what the installer's diff does on a click: only the outline cell's
      // identity moved
      backend.upload(1, { kind: 'outline', data, featureId: 2 })

      expect(
        hal.callsOf('uploadBuffer').map(c => [c.args[0], c.args[1]]),
      ).toEqual([
        [1, 'fillStraight'],
        [1, 'edgeStraight'],
      ])
      // Feature 2 is instance 2, so the packed record must be that one's.
      const packed = hal.getBuffer(1, 'edgeStraight')!
      const full = hal.getBuffer(0, 'fillStraight')!
      expect(packed.count).toBe(1)
      expect(new Uint8Array(packed.data)).toEqual(
        new Uint8Array(full.data).slice(
          2 * INSTANCE_STRIDE_BYTES,
          3 * INSTANCE_STRIDE_BYTES,
        ),
      )
    })

    test('a drawCurves toggle moves the outline to the other edge pass', () => {
      const cells = cellsFor([[0, clickable()]], 1)
      const { hal, render } = gpuFrame(
        cells,
        makeState(outlineParams([[0, makeParams({ clickedFeatureId: 1 })]])),
      )
      hal.calls = []

      render(
        makeState(
          outlineParams([
            [0, makeParams({ clickedFeatureId: 1, drawCurves: true })],
          ]),
        ),
        cells,
      )

      expect(hal.callsOf('drawPass').map(c => c.args)).toEqual([
        ['fillCurve', 0, 'fillStraight'],
        ['edgeCurve', 1, 'edgeStraight'],
      ])
    })

    // The clicked feature can live in a different region than the one being
    // drawn — every region renders with the same clickedFeatureId. An empty
    // pack leaves no buffer, so the pass draws nothing.
    test('an outline cell naming a feature the region lacks packs empty', () => {
      const { hal } = gpuFrame(
        cellsFor([[0, clickable()]], 99),
        makeState(outlineParams([[0, makeParams({ clickedFeatureId: 99 })]])),
      )
      expect(hal.getBuffer(1, 'edgeStraight')).toBeUndefined()
    })
  })

  describe('window-relative uniforms', () => {
    // The panPx uniform is the whole point of the window-relative scheme: it
    // folds the genome-scale (base - viewportStart) delta on the CPU (float64)
    // so a single Float32 corner projects correctly.
    test('panPx projects a genome-scale corner to the correct screen X', () => {
      const base = 1.5e9 // fetch-time base cumBp, past Float32 exact-int
      const data = makeInstanceData(1, {
        base0: base,
        base1: base,
        bp1: bpArr([300]), // corner at cumBp = base + 300
      })
      // Render with the view panned 500px past the fetch base (bpPerPx = 1).
      const offsetPx = base - 500
      const { hal } = gpuFrame(
        cellsFor([[0, data]]),
        makeState([
          [0, makeParams({ offsetPx0: offsetPx, offsetPx1: offsetPx })],
        ]),
      )
      const u = hal.getLastUniformsF32()!
      expect(u[U.panPx0]!).toBeCloseTo(500, 2)
      const screenX = data.bp1[0]! * u[U.bpPerPxInv0]! + u[U.panPx0]!
      expect(screenX).toBeCloseTo((base + 300) / 1 - offsetPx, 2)
    })

    // The shaders size their AA ramps at one OUTPUT pixel, but measure in CSS
    // px, so they need the ratio between the two (aaHalfPx in
    // syntenyTypes.slang). It has to be the same getDpr() that `resolution` is
    // the CSS-px size under.
    test.each([1, 2])('writes devicePixelRatio (dpr=%i)', dpr => {
      Object.defineProperty(window, 'devicePixelRatio', {
        value: dpr,
        writable: true,
      })
      const { hal } = gpuFrame(
        cellsFor([[0, makeInstanceData()]]),
        makeState([[0, makeParams()]]),
      )
      const u = hal.getLastUniformsF32()!
      expect(u[U.devicePixelRatio]).toBe(dpr)
      expect(u[U.resolution]).toBe(800)
      expect(u[U.resolution + 1]).toBe(100)
    })

    test('the band ground and its contrast ink ride the same uniform block', () => {
      const { hal } = gpuFrame(
        cellsFor([[0, makeInstanceData()]]),
        makeState([[0, makeParams()]], { groundColor: '#121212' }),
      )
      const u = hal.getLastUniformsF32()!
      expect(u[U.ground]).toBeCloseTo(18 / 255, 5)
      expect(u[U.ink]).toBeCloseTo(1, 5)
      expect(u[U.yTop]).toBe(0)
      expect(u[U.height]).toBe(100)
      expect(u[U.overdrawPx]).toBe(300)
    })
  })
})

// -------------------------------------------------------------------- pick --

describe('the band pick', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
  })

  function picking(inPath: boolean | (() => boolean) = true) {
    const stub = stubPickCtx(inPath)
    restore = stub.restore
    return { pick: createSyntenyPicker(), calls: stub.calls }
  }

  test('a hit answers the track key and the instance', () => {
    const { pick } = picking()
    const regions = new Map([[0, makeInstanceData()]])
    expect(pick(regions, makeState([[0, makeParams()]]), 800, 50, 50)).toEqual({
      key: 0,
      instanceIndex: 0,
    })
  })

  test('a miss answers nothing', () => {
    const { pick } = picking(false)
    const regions = new Map([[0, makeInstanceData()]])
    expect(
      pick(regions, makeState([[0, makeParams()]]), 800, 50, 50),
    ).toBeUndefined()
  })

  test('a y outside the band answers without consulting the path', () => {
    const { pick, calls } = picking()
    const regions = new Map([[0, makeInstanceData()]])
    expect(
      pick(regions, makeState([[0, makeParams()]]), 800, 50, 9999),
    ).toBeUndefined()
    expect(calls.isPointInPath).toBe(0)
  })

  test('the topmost track wins where two overlap', () => {
    const { pick } = picking()
    const regions = new Map([
      [0, makeInstanceData()],
      [1, makeInstanceData()],
    ])
    const state = makeState(
      [
        [0, makeParams({ yTop: 0, height: 200 })],
        [1, makeParams({ yTop: 0, height: 200 })],
      ],
      { canvasHeight: 200 },
    )
    expect(pick(regions, state, 800, 50, 50)?.key).toBe(1)
  })

  test('each track answers only inside its own yTop range', () => {
    const { pick } = picking()
    const regions = new Map([
      [0, makeInstanceData()],
      [1, makeInstanceData()],
    ])
    const state = makeState(
      [
        [0, makeParams({ yTop: 0, height: 100 })],
        [1, makeParams({ yTop: 100, height: 100 })],
      ],
      { canvasHeight: 200 },
    )
    expect(pick(regions, state, 800, 50, 50)?.key).toBe(0)
    expect(pick(regions, state, 800, 50, 150)?.key).toBe(1)
  })

  test('the last instance of a track wins where several overlap', () => {
    const { pick } = picking()
    const regions = new Map([[0, makeInstanceData(3)]])
    expect(pick(regions, makeState([[0, makeParams()]]), 800, 50, 50)).toEqual({
      key: 0,
      instanceIndex: 2,
    })
  })

  test('a track with no params is not pickable', () => {
    const { pick } = picking()
    const regions = new Map([[0, makeInstanceData()]])
    expect(pick(regions, makeState([]), 800, 50, 50)).toBeUndefined()
  })

  test('curve mode builds a bezier path', () => {
    const { pick, calls } = picking()
    const regions = new Map([[0, makeInstanceData()]])
    expect(
      pick(
        regions,
        makeState([[0, makeParams({ drawCurves: true })]]),
        800,
        50,
        50,
      ),
    ).toEqual({ key: 0, instanceIndex: 0 })
    expect(calls.bezierCurveTo).toBeGreaterThan(0)
  })
})
