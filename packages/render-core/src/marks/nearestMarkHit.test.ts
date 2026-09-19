import { backToFront, nearestMarkHit, valueWindow } from './nearestMarkHit.ts'
import { pointMark } from './pointMark.ts'
import { defineMark } from './types.ts'

import type { HitWindow } from './nearestMarkHit.ts'
import type { PointChannels } from './pointMark.ts'

interface Region {
  under?: PointChannels
  over?: PointChannels
}

const frame = { canvasWidth: 200, canvasHeight: 100 }

// 10 bp per px, so bp 500 is x=50; value 5 on [0, 10] is y=50
const left = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}
const right = {
  ...left,
  displayedRegionIndex: 1,
  screenStartPx: 100,
  screenEndPx: 200,
}

function points(bp: number[], value: number[]): PointChannels {
  return {
    x: Uint32Array.from(bp),
    x2: Uint32Array.from(bp.map(v => v + 1)),
    y: Float32Array.from(value),
    glyph: new Uint8Array(bp.length),
    color: new Uint32Array(bp.length),
    count: bp.length,
  }
}

const markOn = (lane: keyof Region) =>
  defineMark({
    shape: pointMark,
    channels: (r: Region) => r[lane],
    params: () => ({ domain: [0, 10] as [number, number], diameterPx: 4 }),
  })

const MARKS = [markOn('under'), markOn('over')]

function everyInstance(r: Region, mark: number) {
  return backToFront(0, (mark === 0 ? r.under : r.over)?.count ?? 0)
}

function hitAt(
  regions: (Region | undefined)[],
  xPx: number,
  yPx: number,
  candidates: (
    r: Region,
    mark: number,
    reach: HitWindow,
  ) => Iterable<number> | undefined = everyInstance,
) {
  return nearestMarkHit(
    MARKS,
    [left, right],
    i => regions[i],
    frame,
    xPx,
    yPx,
    { radiusPx: 8, candidates },
  )
}

describe('nearestMarkHit', () => {
  test('answers the mark, block, region and instance whose ink is nearest', () => {
    const regions = [{ under: points([100, 500], [5, 5]) }]
    expect(hitAt(regions, 52, 50)).toEqual({
      mark: 0,
      block: left,
      region: regions[0],
      index: 1,
      x: 50,
      y: 50,
      distSq: 4,
    })
  })

  test('a nearer instance in a later block wins', () => {
    const regions = [
      { under: points([990], [5]) },
      { under: points([30], [5]) },
    ]
    // bp 990 on the left is x=99, bp 30 on the right is x=103
    expect(hitAt(regions, 102, 50)?.block).toBe(right)
    expect(hitAt(regions, 100, 50)?.block).toBe(left)
  })

  test('on a tie the mark painted on top wins, and a nearer one underneath still does', () => {
    const tied = [{ under: points([500], [5]), over: points([500], [5]) }]
    expect(hitAt(tied, 50, 50)?.mark).toBe(1)
    const nearerUnder = [
      { under: points([500], [5]), over: points([520], [5]) },
    ]
    expect(hitAt(nearerUnder, 50, 50)?.mark).toBe(0)
  })

  test('nothing within the radius answers nothing', () => {
    expect(hitAt([{ under: points([500], [5]) }], 50, 60)).toBeUndefined()
  })

  test('a block the radius does not reach, with no region, or whose mark is gated off, is not asked', () => {
    const asked: [number, number][] = []
    const record = (r: Region, mark: number, reach: HitWindow) => {
      asked.push([reach.block.displayedRegionIndex, mark])
      return everyInstance(r, mark)
    }
    const both = { under: points([900], [9]), over: points([900], [9]) }
    hitAt([both, both], 50, 50, record)
    expect(asked).toEqual([
      [0, 1],
      [0, 0],
    ])
    asked.length = 0
    // x=100 is within the radius of both columns
    hitAt([undefined, both], 100, 50, record)
    expect(asked).toEqual([
      [1, 1],
      [1, 0],
    ])
    asked.length = 0
    hitAt([{ over: both.over }, {}], 50, 50, record)
    expect(asked).toEqual([[0, 1]])
  })

  test('undefined candidates leave the mark out of that block', () => {
    const regions = [{ under: points([500], [5]), over: points([500], [5]) }]
    expect(
      hitAt(regions, 50, 50, (r, mark) =>
        mark === 1 ? undefined : everyInstance(r, mark),
      )?.mark,
    ).toBe(0)
  })

  test('the window handed to candidates spans the radius in bp and in value', () => {
    const windows: HitWindow[] = []
    hitAt([{ under: points([500], [5]) }], 50, 50, (r, mark, reach) => {
      windows.push(reach)
      return everyInstance(r, mark)
    })
    const [reach] = windows
    expect([reach!.bpMin, reach!.bpMax]).toEqual([420, 580])
    expect(reach!.valueMin).toBeCloseTo(4.2, 9)
    expect(reach!.valueMax).toBeCloseTo(5.8, 9)
  })
})

test('backToFront walks a range from its end', () => {
  expect([...backToFront(2, 5)]).toEqual([4, 3, 2])
  expect([...backToFront(3, 3)]).toEqual([])
})

describe('valueWindow', () => {
  test('reads the radius back through the scale', () => {
    expect(valueWindow(50, 5, frame, { domain: [0, 10] })).toEqual([4.5, 5.5])
    const [lo, hi] = valueWindow(50, 5, frame, {
      domain: [1, 1024],
      scaleType: 'log',
    })
    expect(lo).toBeCloseTo(2 ** 4.5, 9)
    expect(hi).toBeCloseTo(2 ** 5.5, 9)
  })

  test('an end within reach of a plot edge opens, where values clamp', () => {
    expect(valueWindow(3, 5, frame, { domain: [0, 10] })[1]).toBe(Infinity)
    expect(valueWindow(97, 5, frame, { domain: [0, 10] })[0]).toBe(-Infinity)
  })

  test('a point inset from the edge is reachable from the full radius below it', () => {
    // the domain max draws at y=3.2, 6.8 px above a cursor at y=10
    const [, hi] = valueWindow(10, 8, frame, { domain: [0, 10], insetPx: 3.2 })
    expect(hi).toBeGreaterThanOrEqual(10)
  })

  // 150 px in three 50 px bands, the [0, 100] domain ruling each one
  const banded = { canvasWidth: 200, canvasHeight: 150 }
  const rows = { domain: [0, 100] as [number, number], rowHeight: 50 }
  const rounded = (w: [number, number]) => w.map(v => Number(v.toFixed(9)))

  test('each row band is read through its own band, not the whole plot', () => {
    // the centre of every band is the middle of the domain, not 88 then 22
    expect(rounded(valueWindow(25, 8, banded, rows))).toEqual([34, 66])
    expect(rounded(valueWindow(75, 8, banded, rows))).toEqual([34, 66])
    expect(rounded(valueWindow(125, 8, banded, rows))).toEqual([34, 66])
    expect(rounded(valueWindow(25, 8, banded, { ...rows, origin: 0 }))).toEqual(
      [34, Infinity],
    )
  })

  test('a radius that crosses a band seam reaches both bands, and one that does not stays in its own', () => {
    expect(valueWindow(55, 8, banded, rows)).toEqual([-Infinity, Infinity])
    expect(rounded(valueWindow(55, 3, banded, rows))).toEqual([84, 96])
  })

  test('a bar opens away from its origin on the cursor side', () => {
    expect(valueWindow(20, 5, frame, { domain: [0, 10], origin: 0 })).toEqual([
      7.5,
      Infinity,
    ])
    expect(valueWindow(80, 5, frame, { domain: [-10, 10], origin: 0 })).toEqual(
      [-Infinity, -5],
    )
  })
})
