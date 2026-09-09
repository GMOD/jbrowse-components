import { clipBlock } from '../blockClipUtils.ts'
import { MockHal } from '../hal/mockHal.ts'
import { drawMarks, drawPlannedPasses, uploadMarks } from './markBackend.ts'
import { planMarks } from './markPlan.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkShape } from './types.ts'

interface State {
  canvasWidth: number
  canvasHeight: number
  showSecond: boolean
  span: SpanParams
}

function shapeNamed(id: string): MarkShape<SpanChannels, SpanParams> {
  return { ...spanMark, id, pass: { ...spanMark.pass, id } }
}

const channels = (d: SpanChannels) => d
const params = (s: State) => s.span

const first = defineMark({ shape: shapeNamed('first'), channels, params })
const second = defineMark({
  shape: shapeNamed('second'),
  channels,
  params,
  enabled: s => s.showSecond,
})
const borrower = defineMark({
  shape: shapeNamed('borrower'),
  channels,
  params,
  bufferOf: first,
})
const MARKS = [first, second, borrower]

const REGION: SpanChannels = {
  x: Uint32Array.of(10),
  x2: Uint32Array.of(90),
  row: Uint32Array.of(0),
  color: Uint32Array.of(0xff0000ff),
  count: 1,
}

function state(showSecond: boolean): State {
  return {
    canvasWidth: 300,
    canvasHeight: 80,
    showSecond,
    span: {
      rowHeight: 10,
      rowProportion: 1,
      minWidthPx: 0,
      seamPx: 0,
      scrollTop: 0,
    },
  }
}

const BLOCK = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 100,
  screenEndPx: 200,
  reversed: false,
}

function drawnPasses(hal: MockHal) {
  return hal.callsOf('drawPass').map(c => [c.args[0], c.args[2]])
}

test('a plan carries the enabled marks in list order, with their passes', () => {
  const on = planMarks(MARKS, state(true))
  expect(on.marks).toEqual([first, second, borrower])
  expect(on.passes).toEqual([
    { id: 'first', bufferOf: undefined },
    { id: 'second', bufferOf: undefined },
    { id: 'borrower', bufferOf: 'first' },
  ])
  const off = planMarks(MARKS, state(false))
  expect(off.marks).toEqual([first, borrower])
  expect(off.passes.map(p => p.id)).toEqual(['first', 'borrower'])
})

test('drawPlannedPasses issues the plan and nothing else, off the caller uniforms', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  uploadMarks(hal, 0, MARKS, REGION)
  hal.beginFrame(0, 0, 0, 0)
  hal.writeUniforms(new ArrayBuffer(hal.uniformByteSize))
  drawPlannedPasses(hal, planMarks(MARKS, state(false)), 0)
  expect(hal.callsOf('writeUniforms')).toHaveLength(1)
  expect(drawnPasses(hal)).toEqual([
    ['first', undefined],
    ['borrower', 'first'],
  ])
})

test('drawMarks gates on enabled the way a plan does', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  const s = state(false)
  const clip = clipBlock(BLOCK, s.canvasWidth, s.canvasHeight, { x: 1, y: 1 })!
  uploadMarks(hal, 0, MARKS, REGION)
  hal.beginFrame(0, 0, 0, 0)
  drawMarks(
    hal,
    new ArrayBuffer(hal.uniformByteSize),
    MARKS,
    BLOCK,
    clip,
    REGION,
    s,
    0,
  )
  expect(drawnPasses(hal).map(p => p[0])).toEqual(['first', 'borrower'])
})

test('a disabled mark paints nothing and answers no hit', () => {
  const s = state(false)
  const fills: number[] = []
  const ctx = {
    fillStyle: '',
    fillRect: (x: number) => fills.push(x),
  } as never
  second.paintBlock(ctx, REGION, BLOCK, s)
  expect(fills).toEqual([])
  expect(second.hitNearest!(REGION, BLOCK, s, 150, 5, [0], 1)).toBeUndefined()
  first.paintBlock(ctx, REGION, BLOCK, s)
  expect(fills).toHaveLength(1)
  expect(first.hitNearest!(REGION, BLOCK, s, 150, 5, [0], 1)?.index).toBe(0)
})

test('a banded or block-gated mark refuses the plan form', () => {
  const banded = defineMark({
    shape: shapeNamed('banded'),
    channels,
    params,
    band: () => ({ top: 0, height: 10 }),
  })
  const gated = defineMark({
    shape: { ...shapeNamed('gated'), paintsBlock: () => true },
    channels,
    params,
  })
  expect(banded.planned).toBeUndefined()
  expect(gated.planned).toBeUndefined()
  expect(() => planMarks([banded], state(true))).toThrow(/band or a block gate/)
  expect(() => planMarks([gated], state(true))).toThrow(/band or a block gate/)
})
