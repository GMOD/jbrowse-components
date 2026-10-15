import { joinSections } from './joinSections.ts'

test('sections join with read indices offset across them', () => {
  const section = (reads: number, marks: number[]) => ({
    reads: { start: new Float64Array(reads) },
    marks: {
      read: Uint32Array.from(marks),
      position: Float64Array.from(marks),
    },
  })
  const joined = joinSections(
    [
      { columns: { section: 'a', region: 0 }, tables: section(3, [0, 2]) },
      { columns: { section: 'b', region: 1 }, tables: section(2, [1]) },
    ],
    t => t.reads.start.length,
  )
  expect(joined.marks.read).toEqual([0, 2, 4])
  expect(joined.marks.position).toEqual([0, 2, 1])
  expect(joined.marks.section).toEqual(['a', 'a', 'b'])
  expect(joined.reads.section).toEqual(['a', 'a', 'a', 'b', 'b'])
  expect(joined.reads.region).toEqual([0, 0, 0, 1, 1])
})

test('a section of hundreds of thousands of rows joins', () => {
  const n = 300_000
  const joined = joinSections(
    [
      {
        columns: { section: '' },
        tables: {
          reads: { start: new Float64Array(n), read: new Uint32Array(n) },
        },
      },
    ],
    t => t.reads.start.length,
  )
  expect(joined.reads.start).toHaveLength(n)
  expect(joined.reads.section).toHaveLength(n)
})
