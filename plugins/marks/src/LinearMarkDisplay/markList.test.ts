import Flatbush from '@jbrowse/core/util/flatbush'
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { pointInsetPx } from '@jbrowse/render-core/marks'
import { SCALE_TYPE_SYMLOG } from '@jbrowse/render-core/scoreScale'
import * as barShader from '@jbrowse/render-core/shaders/barMarkIface'
import * as pointShader from '@jbrowse/render-core/shaders/pointMarkIface'
import * as spanShader from '@jbrowse/render-core/shaders/spanMarkIface'

import { findMarkHit } from './findMarkHit.ts'
import { buildMarkLegend, markColorScales } from './legend.ts'
import { buildMarkList } from './markList.ts'

import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const RED = 0xff0000ff
const BLUE = 0xffff0000

function layer(
  x: number[],
  y: number[],
  color: number[],
  extra: Partial<StoredLayer> = {},
): StoredLayer {
  const count = x.length
  const xs = Uint32Array.from(x)
  const x2s = Uint32Array.from(x.map(v => v + 10))
  const ys = Float32Array.from(y)
  const fb = new Flatbush(count, undefined, Float64Array)
  for (let i = 0; i < count; i++) {
    fb.add(xs[i]!, ys[i]!, x2s[i], ys[i])
  }
  fb.finish()
  return {
    count,
    skipped: 0,
    x: xs,
    x2: x2s,
    y: ys,
    color: Uint32Array.from(color),
    glyph: new Uint8Array(count),
    featureIndex: Uint32Array.from(x.map((_, i) => i)),
    yMin: Math.min(...y),
    yMax: Math.max(...y),
    flatbushData: fb.data,
    flatbush: Flatbush.from(fb.data),
    ...extra,
  }
}

function entries(...types: MarkEntry['type'][]): MarkEntry[] {
  return types.map(type => ({
    type,
    minBpPerPx: 0,
    maxBpPerPx: 0,
    placed: true,
    valued: type === 'bar' || type === 'point',
    linkShape: 'dome',
  }))
}

const state: MarkRenderState = {
  domainY: [0, 10],
  scaleTypeY: 'linear',
  symlogConstantY: 1,
  colorRamps: [],
  canvasWidth: 800,
  canvasHeight: 400,
  bpPerPx: 1.25,
  origin: 0,
  minWidthPx: 1,
  markSizes: [4, 4, 4, 4],
  sizeScales: [],
  linkRegions: [],
  valueInsetPx: pointInsetPx(4),
  rowCount: 1,
}

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}

const REGIONS = [{ refName: 'ctgA' }]

test('mark i reads layers[i], and every mark gets its own pass id', () => {
  const marks = buildMarkList(entries('bar', 'point', 'span'))
  expect(marks.map(m => m.pass.id)).toEqual(['bar#0', 'point#1', 'span#2'])
  const data: MarkRegionData = {
    layers: [
      layer([42], [0.5], [RED]),
      layer([1337], [7.25], [BLUE]),
      layer([7], [0], [RED], { row: new Uint32Array(1) }),
    ],
  }
  const bar = new Uint32Array(marks[0]!.pass.pack(data) as ArrayBuffer)
  expect(bar[barShader.INSTANCE_OFFSET_U32.x]).toBe(42)
  expect(bar[barShader.INSTANCE_OFFSET_U32.color]).toBe(RED)
  const point = new Uint32Array(marks[1]!.pass.pack(data) as ArrayBuffer)
  expect(point[pointShader.INSTANCE_OFFSET_U32.x]).toBe(1337)
  expect(point[pointShader.INSTANCE_OFFSET_U32.color]).toBe(BLUE)
  expect(marks[2]!.pass.pack(data).byteLength).toBeGreaterThan(0)
})

test('a text mark takes no place in the list, and the marks after it keep their own index', () => {
  const marks = buildMarkList(entries('bar', 'text', 'span'))
  expect(marks.map(m => [m.pass.id, m.markIndex])).toEqual([
    ['bar#0', 0],
    ['span#2', 2],
  ])
  const data: MarkRegionData = {
    layers: [
      layer([500], [5], [RED]),
      { ...layer([500], [5], [RED]), text: ['label'] },
      layer([800], [0], [BLUE], { row: new Uint32Array(1) }),
    ],
  }
  expect(marks[1]!.pass.pack(data).byteLength).toBeGreaterThan(0)
  const hit = findMarkHit(
    402,
    300,
    [block],
    new Map([[0, data]]),
    marks,
    state,
    REGIONS,
  )
  expect(hit).toMatchObject({ markIndex: 0, start: 500, bp: 502 })
  const pastEnd = findMarkHit(
    412,
    300,
    [block],
    new Map([[0, data]]),
    marks,
    state,
    REGIONS,
  )
  expect(pastEnd).toMatchObject({ markIndex: 0, start: 500, bp: 509 })
  const spanHit = findMarkHit(
    641,
    200,
    [block],
    new Map([[0, data]]),
    marks,
    state,
    REGIONS,
  )
  expect(spanHit).toMatchObject({ markIndex: 2, start: 800 })
})

test('a region with fewer layers than marks packs nothing for the missing one', () => {
  const marks = buildMarkList(entries('bar', 'point'))
  const data: MarkRegionData = { layers: [layer([1], [1], [RED])] }
  expect(marks[1]!.pass.pack(data).byteLength).toBe(0)
})

test('a layer without the lanes its type reads packs nothing', () => {
  const [span] = buildMarkList(entries('span'))
  const withoutRow: MarkRegionData = { layers: [layer([1], [1], [RED])] }
  expect(span!.pass.pack(withoutRow).byteLength).toBe(0)
  const withRow: MarkRegionData = {
    layers: [layer([1], [1], [RED], { row: new Uint32Array([2]) })],
  }
  expect(span!.pass.pack(withRow).byteLength).toBeGreaterThan(0)
})

test('a bar and a point take the row lane, each band the plot split by rowCount', () => {
  const [bar, point] = buildMarkList(entries('bar', 'point'))
  const hal = new MockHal([bar!.pass, point!.pass])
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const data: MarkRegionData = {
    layers: [
      layer([100, 500], [5, 5], [RED, BLUE], {
        row: new Uint32Array([0, 1]),
      }),
      layer([100, 500], [5, 5], [RED, BLUE], {
        row: new Uint32Array([1, 0]),
      }),
    ],
  }
  const stacked = { ...state, rowCount: 2 }
  bar!.drawRegion(
    hal,
    new ArrayBuffer(bar!.pass.uniformByteSize),
    block,
    clip,
    data,
    stacked,
    0,
  )
  expect(
    hal.getLastUniformsF32()![barShader.UNIFORM_OFFSET_F32.rowHeight],
  ).toBe(200)
  const packed = new Uint32Array(bar!.pass.pack(data) as ArrayBuffer)
  expect(
    packed[barShader.INSTANCE_STRIDE_WORDS + barShader.INSTANCE_OFFSET_U32.row],
  ).toBe(1)
  point!.drawRegion(
    hal,
    new ArrayBuffer(point!.pass.uniformByteSize),
    block,
    clip,
    data,
    stacked,
    0,
  )
  expect(
    hal.getLastUniformsF32()![pointShader.UNIFORM_OFFSET_F32.rowHeight],
  ).toBe(200)
  // one row: the band is the plot, which is what every bar drew in before
  bar!.drawRegion(
    hal,
    new ArrayBuffer(bar!.pass.uniformByteSize),
    block,
    clip,
    data,
    state,
    0,
  )
  expect(
    hal.getLastUniformsF32()![barShader.UNIFORM_OFFSET_F32.rowHeight],
  ).toBe(state.canvasHeight)
})

test('a span mark stacks on the row lane, the bands dividing the plot by rowCount', () => {
  const [mark] = buildMarkList(entries('span'))
  const hal = new MockHal([mark!.pass])
  const scratch = new ArrayBuffer(mark!.pass.uniformByteSize)
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const data: MarkRegionData = {
    layers: [
      layer([100, 500], [0, 0], [RED, BLUE], {
        row: new Uint32Array([0, 1]),
        y: undefined,
      }),
    ],
  }
  const stacked = { ...state, rowCount: 2 }
  mark!.drawRegion(hal, scratch, block, clip, data, stacked, 0)
  expect(
    hal.getLastUniformsF32()![spanShader.UNIFORM_OFFSET_F32.rowHeight],
  ).toBe(200)
  // 500 bp is x=400; row 1 is the lower band, y 200..400
  const hit = findMarkHit(
    402,
    300,
    [block],
    new Map([[0, data]]),
    [mark!],
    stacked,
    REGIONS,
  )
  expect(hit).toMatchObject({ instance: 1, start: 500, color: BLUE })
  expect(hit?.y).toBeUndefined()
  expect(
    findMarkHit(
      402,
      100,
      [block],
      new Map([[0, data]]),
      [mark!],
      stacked,
      REGIONS,
    ),
  ).toBeUndefined()
})

test('a bar mark writes the origin and the domain into its uniforms', () => {
  const [mark] = buildMarkList(entries('bar'))
  const hal = new MockHal([mark!.pass])
  const scratch = new ArrayBuffer(mark!.pass.uniformByteSize)
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  mark!.drawRegion(
    hal,
    scratch,
    block,
    clip,
    { layers: [layer([500], [5], [RED])] },
    { ...state, origin: 2 },
    0,
  )
  const u = hal.getLastUniformsF32()!
  expect(u[barShader.UNIFORM_OFFSET_F32.origin]).toBe(2)
  expect(u[barShader.UNIFORM_OFFSET_F32.domainMax]).toBe(10)
})

test('a symlog y scale writes its type and resolved constant into both marks', () => {
  const marks = buildMarkList(entries('bar', 'point'))
  const symlog = {
    ...state,
    scaleTypeY: 'symlog' as const,
    symlogConstantY: 0.05,
  }
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const data: MarkRegionData = {
    layers: [layer([500], [5], [RED]), layer([800], [8], [BLUE])],
  }
  const uniformsOf = (i: number) => {
    const hal = new MockHal([marks[i]!.pass])
    const scratch = new ArrayBuffer(marks[i]!.pass.uniformByteSize)
    marks[i]!.drawRegion(hal, scratch, block, clip, data, symlog, 0)
    return { f32: hal.getLastUniformsF32()!, i32: hal.getLastUniformsI32()! }
  }
  const bar = uniformsOf(0)
  expect(bar.i32[barShader.UNIFORM_OFFSET_I32.valueScaleType]).toBe(
    SCALE_TYPE_SYMLOG,
  )
  expect(bar.f32[barShader.UNIFORM_OFFSET_F32.valueSymlogConstant]).toBeCloseTo(
    0.05,
  )
  const point = uniformsOf(1)
  expect(point.i32[pointShader.UNIFORM_OFFSET_I32.valueScaleType]).toBe(
    SCALE_TYPE_SYMLOG,
  )
  expect(
    point.f32[pointShader.UNIFORM_OFFSET_F32.valueSymlogConstant],
  ).toBeCloseTo(0.05)
})

test('every mark places its value through the display s one domain', () => {
  const marks = buildMarkList(entries('bar', 'point'))
  const shared = { ...state, domainY: [0, 100] as [number, number] }
  const data: MarkRegionData = {
    layers: [layer([500], [5], [RED]), layer([800], [80], [BLUE])],
  }
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const domainMaxOf = (i: number, offset: number) => {
    const hal = new MockHal([marks[i]!.pass])
    const scratch = new ArrayBuffer(marks[i]!.pass.uniformByteSize)
    marks[i]!.drawRegion(hal, scratch, block, clip, data, shared, 0)
    return hal.getLastUniformsF32()![offset]
  }
  expect(domainMaxOf(0, barShader.UNIFORM_OFFSET_F32.domainMax)).toBe(100)
  expect(domainMaxOf(1, pointShader.UNIFORM_OFFSET_F32.domainMax)).toBe(100)

  // 80 on [0, 100] over 400 px is y=80, and the hit test measures in the same
  // scale the marks drew in.
  const hit = findMarkHit(
    641,
    81,
    [block],
    new Map([[0, data]]),
    marks,
    shared,
    REGIONS,
  )
  expect(hit).toMatchObject({ markIndex: 1, start: 800, y: 80 })
})

test('a mark outside its zoom range neither draws nor answers a hover', () => {
  const [mark] = buildMarkList([
    {
      type: 'bar',
      minBpPerPx: 10,
      maxBpPerPx: 0,
      placed: true,
      valued: true,
      linkShape: 'dome',
    },
  ])
  const hal = new MockHal([mark!.pass])
  const scratch = new ArrayBuffer(mark!.pass.uniformByteSize)
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const data = { layers: [layer([500], [5], [RED])] }
  const hitAt = (bpPerPx: number) =>
    findMarkHit(
      402,
      300,
      [block],
      new Map([[0, data]]),
      [mark!],
      { ...state, bpPerPx },
      REGIONS,
    )
  mark!.drawRegion(hal, scratch, block, clip, data, state, 0)
  expect(hal.getLastUniformsF32()).toBeNull()
  expect(hitAt(1.25)).toBeUndefined()
  mark!.drawRegion(
    hal,
    scratch,
    block,
    clip,
    data,
    { ...state, bpPerPx: 10 },
    0,
  )
  expect(hal.getLastUniformsF32()).not.toBeNull()
  expect(hitAt(10)?.instance).toBe(0)
})

describe('findMarkHit', () => {
  const marks = buildMarkList(entries('bar', 'point'))
  // a bar at 500 bp reaching from the origin to 5, a point at 800 bp at 8
  const regions = new Map<number, MarkRegionData>([
    [
      0,
      {
        layers: [layer([500], [5], [RED]), layer([800], [8], [BLUE])],
      },
    ],
  ])

  test('a cursor inside a bar hits it below its value', () => {
    // value 5 on a [0, 10] domain over 400 px is y=200; y=300 is value 2.5
    const hit = findMarkHit(402, 300, [block], regions, marks, state, REGIONS)
    expect(hit).toMatchObject({
      markIndex: 0,
      instance: 0,
      refName: 'ctgA',
      start: 500,
      end: 510,
      y: 5,
      color: RED,
    })
  })

  test('a cursor above a bar misses it', () => {
    expect(
      findMarkHit(402, 100, [block], regions, marks, state, REGIONS),
    ).toBeUndefined()
  })

  test('a point answers at its shape', () => {
    // 800 bp is x=640; value 8 is y=80
    const hit = findMarkHit(641, 81, [block], regions, marks, state, REGIONS)
    expect(hit).toMatchObject({ markIndex: 1, start: 800, y: 8, color: BLUE })
  })

  test('a row lane bands the plot, and each band is hovered on its own scale', () => {
    // two 200 px bands: the bar on row 0 grows from its origin at y=200 up to
    // y=100, and the point on row 1 sits at y=242
    const stacked = { ...state, rowCount: 2 }
    const banded = new Map<number, MarkRegionData>([
      [
        0,
        {
          layers: [
            layer([500], [5], [RED], { row: new Uint32Array([0]) }),
            layer([800], [8], [BLUE], { row: new Uint32Array([1]) }),
          ],
        },
      ],
    ])
    const hitAt = (x: number, y: number) =>
      findMarkHit(x, y, [block], banded, marks, stacked, REGIONS)
    expect(hitAt(402, 150)).toMatchObject({ markIndex: 0, start: 500, y: 5 })
    expect(hitAt(641, 242)).toMatchObject({ markIndex: 1, start: 800, y: 8 })
    // where one band over the whole plot would have drawn them
    expect(hitAt(402, 300)).toBeUndefined()
    expect(hitAt(641, 81)).toBeUndefined()
  })

  test('a point on a log scale is asked about through the log window', () => {
    // 32 on a log [1, 1024] is half way, y=200; a linear window there reads
    // about 500 and would leave it out of the index query
    const logRegions = new Map<number, MarkRegionData>([
      [0, { layers: [layer([500], [0], [RED]), layer([800], [32], [BLUE])] }],
    ])
    const hit = findMarkHit(
      641,
      205,
      [block],
      logRegions,
      marks,
      { ...state, domainY: [1, 1024], scaleTypeY: 'log' },
      REGIONS,
    )
    expect(hit).toMatchObject({ markIndex: 1, start: 800, y: 32 })
  })

  test('a point on a symlog scale is asked about through its own constant', () => {
    // 9.9 on a symlog [0, 1000] with constant 0.1 is half way, y=200, and
    // the window read there has to hold it; a constant of 1 draws it at y=262
    const symlogRegions = new Map<number, MarkRegionData>([
      [0, { layers: [layer([500], [0], [RED]), layer([800], [9.9], [BLUE])] }],
    ])
    const hitAt = (symlogConstantY: number) =>
      findMarkHit(
        641,
        205,
        [block],
        symlogRegions,
        marks,
        {
          ...state,
          domainY: [0, 1000],
          scaleTypeY: 'symlog',
          symlogConstantY,
        },
        REGIONS,
      )
    expect(hitAt(0.1)).toMatchObject({ markIndex: 1, start: 800 })
    expect(hitAt(1)).toBeUndefined()
  })
})

test("the legend unions categorical tables across regions, keeping the first colour, and lists them in the field's order", () => {
  const regionA: MarkRegionData = {
    layers: [
      layer([1], [1], [RED], {
        scale: {
          kind: 'categorical',
          field: 'type',
          domain: [],
          entries: [{ value: 'gene', color: RED }],
        },
      }),
    ],
  }
  const regionB: MarkRegionData = {
    layers: [
      layer([1], [1], [BLUE], {
        scale: {
          kind: 'categorical',
          field: 'type',
          domain: [],
          entries: [
            { value: 'exon', color: BLUE },
            { value: 'gene', color: BLUE },
          ],
        },
      }),
    ],
  }
  const sections = buildMarkLegend([regionA, regionB])
  expect(sections).toEqual([
    {
      markIndexes: [0],
      channel: 'color',
      scale: {
        kind: 'categorical',
        field: 'type',
        domain: [],
        entries: [
          { value: 'gene', color: RED },
          { value: 'exon', color: BLUE },
        ],
      },
      title: 'type',
    },
  ])
  expect(
    markColorScales(sections).flatMap(s =>
      s.kind === 'categorical' ? s.entries.map(e => e.value) : [],
    ),
  ).toEqual(['exon', 'gene'])
})
