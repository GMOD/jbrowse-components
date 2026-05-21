import { placeRect } from './placeRect.ts'

function assertNonOverlapping(
  rows: number[][],
  placements: { start: number; end: number; y: number }[],
) {
  // Reconstruct per-row placements from placements[] and verify no pair in
  // the same row overlaps on raw [start, end] extents.
  const byRow = new Map<number, { start: number; end: number }[]>()
  for (const p of placements) {
    if (!byRow.has(p.y)) {
      byRow.set(p.y, [])
    }
    byRow.get(p.y)!.push({ start: p.start, end: p.end })
  }
  for (const items of byRow.values()) {
    items.sort((a, b) => a.start - b.start)
    for (let i = 1; i < items.length; i++) {
      if (items[i]!.start < items[i - 1]!.end) {
        throw new Error('overlap within row')
      }
    }
  }
  // rows[] itself must be sorted by start with non-overlapping padded
  // intervals (padding = 2 built into placeRect).
  for (const row of rows) {
    for (let i = 2; i < row.length; i += 2) {
      if (row[i]! < row[i - 1]!) {
        throw new Error(`row not sorted at ${i}: ${row.join(',')}`)
      }
    }
  }
}

describe('placeRect', () => {
  test('empty rows: first rect creates row 0', () => {
    const rows: number[][] = []
    expect(placeRect(rows, 100, 200)).toBe(0)
    expect(rows.length).toBe(1)
  })

  test('non-overlapping sequential rects share a row via append fast-path', () => {
    const rows: number[][] = []
    expect(placeRect(rows, 0, 100)).toBe(0)
    expect(placeRect(rows, 200, 300)).toBe(0)
    expect(placeRect(rows, 400, 500)).toBe(0)
    expect(rows.length).toBe(1)
    // Last end must be ≤ next start → [0,102,200,302,400,502]
    expect(rows[0]).toEqual([0, 102, 200, 302, 400, 502])
  })

  test('overlapping rects go to different rows', () => {
    const rows: number[][] = []
    expect(placeRect(rows, 0, 200)).toBe(0)
    expect(placeRect(rows, 100, 300)).toBe(1)
    expect(placeRect(rows, 200, 400)).toBe(2) // 200<202 (padded end of row0)
  })

  test('gap-fill: out-of-order rect with small start fits in row 0 gap', () => {
    const rows: number[][] = []
    placeRect(rows, 500, 700) // row 0
    placeRect(rows, 550, 800) // row 1
    expect(placeRect(rows, 10, 100)).toBe(0) // fits before 500 in row 0
  })

  test('padding: rects exactly abutting get different rows', () => {
    const rows: number[][] = []
    placeRect(rows, 0, 100) // paddedEnd = 102
    // start=100 is NOT ≥ 102 → can't fit in row 0
    expect(placeRect(rows, 100, 200)).toBe(1)
    // start=102 IS ≥ 102 → fits
    expect(placeRect(rows, 102, 200)).toBe(0)
  })

  test('wide row (linear path, <32 intervals): 10 sequential rects pack in row 0', () => {
    const rows: number[][] = []
    for (let i = 0; i < 10; i++) {
      expect(placeRect(rows, i * 100, i * 100 + 50)).toBe(0)
    }
    expect(rows.length).toBe(1)
    expect(rows[0]!.length).toBe(20)
  })

  test('wide row (binary path, >=32 intervals): 100 sequential rects pack in row 0', () => {
    const rows: number[][] = []
    for (let i = 0; i < 100; i++) {
      expect(placeRect(rows, i * 100, i * 100 + 50)).toBe(0)
    }
    expect(rows.length).toBe(1)
    expect(rows[0]!.length).toBe(200)
  })

  test('wide row gap-fill via binary search: 50 even slots, fillers land in odd gaps', () => {
    const rows: number[][] = []
    for (let i = 0; i < 50; i++) {
      placeRect(rows, i * 100, i * 100 + 40)
    }
    // Each even slot has a gap [i*100+42, (i+1)*100). Insert fillers
    // in reverse order so they must splice into the middle.
    for (let i = 49; i >= 0; i--) {
      const y = placeRect(rows, i * 100 + 50, i * 100 + 80)
      expect(y).toBe(0)
    }
    expect(rows.length).toBe(1)
  })

  test('wide row collision mid-row: binary search finds correct candidate', () => {
    const rows: number[][] = []
    // Row 0: 100 intervals at [0..80], [100..180], ..., [9900..9980]
    for (let i = 0; i < 100; i++) {
      placeRect(rows, i * 100, i * 100 + 80)
    }
    // Rect overlaps interval #50 at [5000, 5080]
    const y = placeRect(rows, 5050, 5150)
    expect(y).toBe(1)
    // Row 0 unchanged, row 1 has only the new rect
    expect(rows[0]!.length).toBe(200)
    expect(rows[1]).toEqual([5050, 5152])
  })

  test('wide row: new rect spans multiple existing intervals — collision', () => {
    const rows: number[][] = []
    for (let i = 0; i < 100; i++) {
      placeRect(rows, i * 100, i * 100 + 80)
    }
    // Rect [500, 2500] overlaps intervals #5..#24. Binary search finds
    // interval #5 as first end>500, its start=500<2502 → collision.
    const y = placeRect(rows, 500, 2500)
    expect(y).toBe(1)
  })

  test('randomized stress: 5000 rects, no within-row overlaps', () => {
    const rows: number[][] = []
    const placements: { start: number; end: number; y: number }[] = []
    // Seeded pseudo-random so failure is reproducible
    let seed = 42
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 5000; i++) {
      const start = Math.floor(rand() * 100000)
      const end = start + 50 + Math.floor(rand() * 200)
      const y = placeRect(rows, start, end)
      placements.push({ start, end, y })
    }
    assertNonOverlapping(rows, placements)
  })
})
