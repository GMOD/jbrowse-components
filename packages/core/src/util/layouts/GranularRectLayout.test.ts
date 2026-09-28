import Layout from './GranularRectLayout.ts'

test('lays out non-overlapping features end to end', () => {
  const l = new Layout({ pitchX: 10, pitchY: 4 })
  const testRects = [
    ['1,0', 4133, 5923, 16],
    ['1,1', 11299, 12389, 16],
    ['1,2', 21050, 22778, 16],
    ['1,3', 41125, 47459, 16],
    ['1,4', 47926, 49272, 16],
    ['1,5', 50240, 52495, 16],
    ['1,6', 53329, 56283, 16],
    ['1,7', 59309, 79441, 16],
    ['1,8', 80359, 83196, 16],
    ['1,9', 92147, 94188, 16],
    ['1,10', 96241, 103626, 16],
    ['1,11', 104396, 108110, 16],
    ['1,12', 111878, 125251, 16],
    ['1,13', 125747, 128085, 16],
    ['1,14', 131492, 132641, 16],
    ['1,15', 133857, 134931, 16],
    ['1,16', 137023, 138220, 16],
    ['1,17', 140703, 145668, 16],
    ['1,18', 146045, 147059, 16],
    ['1,19', 162296, 165395, 16],
    ['1,20', 168531, 170795, 16],
    ['1,21', 174812, 180475, 16],
    ['1,22', 184302, 188826, 16],
    ['1,23', 189609, 191141, 16],
    ['1,24', 199799, 201389, 16],
    ['1,25', 203436, 211345, 16],
    ['1,26', 212100, 212379, 16],
    ['1,27', 213418, 214627, 16],
    ['1,28', 215115, 219344, 16],
    ['1,29', 220067, 222525, 16],
    ['1,30', 223308, 228141, 16],
    ['1,31', 234473, 236768, 16],
    ['1,32', 239691, 245015, 16],
  ] as [string, number, number, number][]

  for (const rect of testRects) {
    const top = l.addRect(...rect)
    expect(top).toEqual(0)
  }
})

test('stacks up overlapping features', () => {
  const l = new Layout({ pitchX: 10, pitchY: 4 })

  const testRects = [] as [string, number, number, number][]
  for (let i = 1; i <= 20; i += 1) {
    testRects.push([`feature-${i}`, 100 * i - 60, 100 * i + 60, 1] as const)
  }

  for (const [i, testRect] of testRects.entries()) {
    const top = l.addRect(...testRect)
    expect(top).toEqual((i % 2) * 4)
  }
})

test('a feature past maxHeight gets no row', () => {
  const l = new Layout({ pitchX: 1, pitchY: 1, maxHeight: 1 })

  expect(l.addRect('a', 0, 100, 1)).toBe(0)
  expect(l.addRect('b', 0, 100, 1)).toBe(1)
  expect(l.addRect('c', 0, 100, 1)).toBeNull()
})

test('re-adding a laid-out id returns the row it already has', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('a', 0, 100, 10)).toBe(0)
  expect(l.addRect('b', 0, 100, 10)).toBe(10)
  expect(l.addRect('a', 500, 600, 10)).toBe(0)
})

test('tests adding features far apart in coordinate space', () => {
  const l = new Layout({
    pitchX: 1,
    pitchY: 1,
    maxHeight: 600,
  })

  // Add features very far apart - this tests that the layout
  // can handle sparse coordinate spaces efficiently
  expect(l.addRect('test1', 0, 10000, 1)).toBe(0)
  expect(l.addRect('test2', 1000000, 1000100, 1)).toBe(0)
  expect(l.addRect('test3', 0, 10000, 1)).toBe(1)
})

test('a tall feature takes the row below a blocker, not the row below itself', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  // The blocker occupies row 0 alone. A 3-row feature over the same span clears
  // at row 1, so the scan may only skip past the row that blocked it — skipping
  // the blocked rect's own height instead would land this at 30.
  expect(l.addRect('blocker', 0, 1000, 10)).toBe(0)
  expect(l.addRect('tall', 0, 1000, 30)).toBe(10)
})

test('a very wide feature leaves its rows free where it does not reach', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('wide', 11_307_000, 11_391_000, 150)).toBe(0)
  expect(l.addRect('clear', 11_420_000, 11_421_000, 30)).toBe(0)
})

test('a very wide feature still stacks the features it does reach', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('wide', 11_307_000, 11_391_000, 150)).toBe(0)
  expect(l.addRect('under', 11_350_000, 11_351_000, 30)).toBe(150)
})

test('a lower span keeps its rows clear where the rows above may abut', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('tall', 0, 100, 30)).toBe(0)
  // The two top rows may sit flush against the tall rect, and the two under
  // them reach back over its end, so they must clear it. A hit in the lower
  // span at row 2 still leaves top 1 to try, where row 2 falls in the top rows.
  expect(
    l.addRect('labeled', 101, 200, 40, { top: 20, left: 95, right: 200 }),
  ).toBe(10)
})

test('a lower span may be narrower than the rows above it', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('a', 0, 100, 20, { top: 10, left: 40, right: 60 })).toBe(0)
  expect(l.addRect('b', 0, 10, 10)).toBe(10)
})

test('a lower span starts at the first row wholly past its top', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('beside', 0, 95, 20)).toBe(0)
  expect(l.addRect('a', 100, 200, 30, { top: 12, left: 90, right: 200 })).toBe(
    0,
  )
})

test('a later rect clears the lower span, not just the rect', () => {
  const l = new Layout({ pitchX: 1, pitchY: 10 })

  expect(l.addRect('a', 100, 200, 30, { top: 10, left: 90, right: 200 })).toBe(
    0,
  )
  expect(l.addRect('beside', 0, 95, 10)).toBe(0)
  expect(l.addRect('under', 0, 95, 10)).toBe(30)
})
