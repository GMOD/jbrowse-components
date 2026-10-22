import { joinControl } from './joinControl.ts'

import type { AxisMasks } from './joinControl.ts'

function records(cells: [number, number, number][]) {
  return {
    bin1: Int32Array.from(cells, c => c[0]),
    bin2: Int32Array.from(cells, c => c[1]),
    counts: Float32Array.from(cells, c => c[2]),
  }
}

function join(
  observed: [number, number, number][],
  control: [number, number, number][],
  masks: {
    observed?: AxisMasks
    control?: AxisMasks
    x0?: number
    y0?: number
  } = {},
) {
  const out = joinControl(records(observed), records(control), {
    observed: masks.observed ?? {},
    control: masks.control ?? {},
    x0: masks.x0 ?? 0,
    y0: masks.y0 ?? 0,
  })
  return Array.from(out.bin1, (b1, i) => [
    b1,
    out.bin2[i],
    out.counts[i],
    out.control[i],
  ]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
}

test('a cell both files list pairs its two counts', () => {
  expect(join([[3, 5, 10]], [[3, 5, 4]])).toEqual([[3, 5, 10, 4]])
})

// the cell a condition lost is the point of the comparison
test('a cell only one file lists is a zero in the other', () => {
  expect(
    join(
      [
        [0, 0, 7],
        [1, 4, 2],
      ],
      [
        [0, 0, 6],
        [2, 9, 5],
      ],
    ),
  ).toEqual([
    [0, 0, 7, 6],
    [1, 4, 2, 0],
    [2, 9, 0, 5],
  ])
})

test('a cell the other file masks is left out, not read as zero', () => {
  // the control masks x bin 1; the map masks y bin 9
  expect(
    join(
      [
        [1, 4, 2],
        [2, 4, 3],
      ],
      [
        [2, 9, 5],
        [3, 9, 6],
      ],
      {
        control: { x: Uint8Array.of(1, 0, 1, 1) },
        observed: { y: Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 1, 0) },
      },
    ),
  ).toEqual([[2, 4, 3, 0]])
})

test('masks are read from the window origin they were built over', () => {
  expect(
    join([[101, 104, 2]], [], {
      control: { x: Uint8Array.of(1, 0), y: Uint8Array.of(1, 1, 1, 1, 1) },
      x0: 100,
      y0: 100,
    }),
  ).toEqual([])
})

test('every record either way, matched once, at scale', () => {
  const observed: [number, number, number][] = []
  const control: [number, number, number][] = []
  for (let b1 = 0; b1 < 60; b1++) {
    for (let b2 = b1; b2 < 60; b2 += 1 + (b1 % 3)) {
      observed.push([b1, b2, b1 + b2])
      if ((b1 + b2) % 4 !== 0) {
        control.push([b1, b2, 1])
      }
    }
    control.push([b1, 200, 9])
  }
  const out = join(observed, control)
  const both = observed.filter(([b1, b2]) => (b1 + b2) % 4 !== 0).length
  expect(out.length).toBe(observed.length + control.length - both)
  expect(new Set(out.map(r => `${r[0]}_${r[1]}`)).size).toBe(out.length)
})
