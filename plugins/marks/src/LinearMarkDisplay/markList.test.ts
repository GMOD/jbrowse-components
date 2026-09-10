import Flatbush from '@jbrowse/core/util/flatbush'
import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import * as barShader from '@jbrowse/render-core/shaders/barMarkIface'
import * as pointShader from '@jbrowse/render-core/shaders/pointMarkIface'
import * as spanShader from '@jbrowse/render-core/shaders/spanMarkIface'

import { findMarkHit } from './findMarkHit.ts'
import { buildMarkLegend } from './legend.ts'
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

function entries(...shapes: MarkEntry['shape'][]): MarkEntry[] {
  return shapes.map(shape => ({ shape, minBpPerPx: 0, maxBpPerPx: 0 }))
}

const state: MarkRenderState = {
  domainY: [0, 10],
  canvasWidth: 800,
  canvasHeight: 400,
  bpPerPx: 1.25,
  origin: 0,
  minWidthPx: 1,
  pointDiameterPx: 4,
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

test('a region with fewer layers than marks packs nothing for the missing one', () => {
  const marks = buildMarkList(entries('bar', 'point'))
  const data: MarkRegionData = { layers: [layer([1], [1], [RED])] }
  expect(marks[1]!.pass.pack(data).byteLength).toBe(0)
})

test('a layer without the lanes its shape reads packs nothing', () => {
  const [span] = buildMarkList(entries('span'))
  const withoutRow: MarkRegionData = { layers: [layer([1], [1], [RED])] }
  expect(span!.pass.pack(withoutRow).byteLength).toBe(0)
  const withRow: MarkRegionData = {
    layers: [layer([1], [1], [RED], { row: new Uint32Array([2]) })],
  }
  expect(span!.pass.pack(withRow).byteLength).toBeGreaterThan(0)
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
    ['span'],
    stacked,
    new Map([[0, 'ctgA']]),
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
      ['span'],
      stacked,
      new Map([[0, 'ctgA']]),
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

test('a mark outside its zoom range neither draws nor answers a hover', () => {
  const [mark] = buildMarkList([
    { shape: 'bar', minBpPerPx: 10, maxBpPerPx: 0 },
  ])
  const hal = new MockHal([mark!.pass])
  const scratch = new ArrayBuffer(mark!.pass.uniformByteSize)
  const clip = clipBlock(block, state.canvasWidth, state.canvasHeight, {
    x: 1,
    y: 1,
  })!
  const data = { layers: [layer([500], [5], [RED])] }
  const refNames = new Map([[0, 'ctgA']])
  const hitAt = (bpPerPx: number) =>
    findMarkHit(
      402,
      300,
      [block],
      new Map([[0, data]]),
      [mark!],
      ['bar'],
      { ...state, bpPerPx },
      refNames,
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
  const refNames = new Map([[0, 'ctgA']])
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
    const hit = findMarkHit(
      402,
      300,
      [block],
      regions,
      marks,
      ['bar', 'point'],
      state,
      refNames,
    )
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
      findMarkHit(
        402,
        100,
        [block],
        regions,
        marks,
        ['bar', 'point'],
        state,
        refNames,
      ),
    ).toBeUndefined()
  })

  test('a point answers at its glyph', () => {
    // 800 bp is x=640; value 8 is y=80
    const hit = findMarkHit(
      641,
      81,
      [block],
      regions,
      marks,
      ['bar', 'point'],
      state,
      refNames,
    )
    expect(hit).toMatchObject({ markIndex: 1, start: 800, y: 8, color: BLUE })
  })
})

test('the legend unions categorical tables across regions and keeps the first colour', () => {
  const regionA: MarkRegionData = {
    layers: [
      layer([1], [1], [RED], {
        scale: {
          kind: 'categorical',
          field: 'type',
          entries: [{ label: 'gene', color: RED }],
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
          entries: [
            { label: 'exon', color: BLUE },
            { label: 'gene', color: BLUE },
          ],
        },
      }),
    ],
  }
  expect(buildMarkLegend([regionA, regionB])).toEqual([
    {
      markIndex: 0,
      channel: 'color',
      scale: {
        kind: 'categorical',
        field: 'type',
        entries: [
          { label: 'gene', color: RED },
          { label: 'exon', color: BLUE },
        ],
      },
    },
  ])
})
