import { joinTables } from './joinTables.ts'

test('parts join with each index column offset into the table it names', () => {
  const section = (reads: number, marks: number[]) => ({
    reads: { start: new Float64Array(reads) },
    marks: {
      read: Uint32Array.from(marks),
      position: Float64Array.from(marks),
    },
  })
  const joined = joinTables(
    [
      { columns: { section: 'a', region: 0 }, tables: section(3, [0, 2]) },
      { columns: { section: 'b', region: 1 }, tables: section(2, [1]) },
    ],
    { read: 'reads' },
  )
  expect(joined.marks.read).toEqual([0, 2, 4])
  expect(joined.marks.position).toEqual([0, 2, 1])
  expect(joined.marks.section).toEqual(['a', 'a', 'b'])
  expect(joined.reads.section).toEqual(['a', 'a', 'a', 'b', 'b'])
  expect(joined.reads.region).toEqual([0, 0, 0, 1, 1])
})

test('a negative index names no row and stays as it is', () => {
  const part = {
    columns: {},
    tables: {
      features: { id: ['f'] },
      subfeatures: { id: ['s'], feature: [0] },
      rects: { feature: [0, 0], subfeature: [-1, 0] },
    },
  }
  const joined = joinTables([part, part], {
    feature: 'features',
    subfeature: 'subfeatures',
  })
  expect(joined.subfeatures.feature).toEqual([0, 1])
  expect(joined.rects.feature).toEqual([0, 0, 1, 1])
  expect(joined.rects.subfeature).toEqual([-1, 0, -1, 1])
})

test('a kept table leaves out the rows naming a row it rejects', () => {
  const joined = joinTables(
    [
      {
        columns: {},
        tables: {
          reads: { start: [10, 20, 30] },
          marks: { read: [0, 1, 2, 1] },
        },
        keep: { reads: (read: number) => read !== 1 },
      },
      {
        columns: {},
        tables: { reads: { start: [40] }, marks: { read: [0] } },
      },
    ],
    { read: 'reads' },
  )
  expect(joined.reads.start).toEqual([10, 30, 40])
  expect(joined.marks.read).toEqual([0, 1, 2])
})

test('a part of hundreds of thousands of rows joins', () => {
  const n = 300_000
  const joined = joinTables(
    [
      {
        columns: { section: '' },
        tables: {
          reads: { start: new Float64Array(n), read: new Uint32Array(n) },
        },
      },
    ],
    { read: 'reads' },
  )
  expect(joined.reads.start).toHaveLength(n)
  expect(joined.reads.section).toHaveLength(n)
})
