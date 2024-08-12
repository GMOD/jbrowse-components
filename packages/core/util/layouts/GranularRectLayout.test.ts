import Layout from './GranularRectLayout'

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

  for (let i = 0; i < testRects.length; i += 1) {
    const top = l.addRect(...testRects[i]!)
    expect(top).toEqual((i % 2) * 4)
  }
})

test('discards regions', () => {
  const l = new Layout({ pitchX: 10, pitchY: 4 })
  for (let i = 0; i < 20; i += 1) {
    const top = l.addRect(
      `feature-${i}`,
      10000 * i + 4000,
      10000 * i + 16000,
      1,
    )
    expect(top).toEqual((i % 2) * 4)
  }

  // @ts-expect-error
  expect(l.bitmap[0].rowState.bits.length).toBe(34812)
  // @ts-expect-error
  expect(l.bitmap[1].rowState.bits.length).toBe(34812)
  l.discardRange(190000, 220000)
  // @ts-expect-error
  expect(l.bitmap[0].rowState.bits.length).toBe(24802)
  // @ts-expect-error
  expect(l.bitmap[1].rowState.bits.length).toBe(23802)
  l.discardRange(0, 100000)
  // @ts-expect-error
  expect(l.bitmap[0].rowState.bits.length).toBe(19001)
  // @ts-expect-error
  expect(l.bitmap[1].rowState.bits.length).toBe(23802)
  l.discardRange(0, 220000)
  // @ts-expect-error
  expect(l.bitmap[0].rowState).toBeUndefined()
})

// see issue #486
test('tests that adding +/- pitchX fixes resolution causing errors', () => {
  const l = new Layout({ pitchX: 91.21851599727707, pitchY: 3 })

  l.addRect('test', 2581541, 2581542, 1)

  expect(
    l.serializeRegion({ start: 2581491, end: 2818659 }).rectangles.test,
  ).toBeTruthy()
})

test('tests reinitializing layout due to throwing away old one', () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const l = new Layout({
    pitchX: 1,
    pitchY: 1,
    maxHeight: 600,
  })

  l.addRect('test1', 0, 10000, 1)
  l.addRect('test2', 1000000, 1000100, 1)
  l.addRect('test3', 0, 10000, 1)
  // @ts-expect-error
  expect(l.rectangles.size).toBe(3)
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

test('tests adding a gigantic feature that fills entire row with another smaller added on top', () => {
  const l = new Layout({
    pitchX: 100,
    pitchY: 1,
    maxHeight: 600,
  })

  expect(l.getByCoord(50000, 0)).toEqual(undefined)
  l.addRect('test1', 0, 100000000, 1, 'feat1')
  expect(l.getByCoord(50000, 0)).toEqual('test1')
  l.addRect('test2', 0, 1000, 1, 'feat2')
  expect(l.getByCoord(500, 1)).toEqual('test2')
  // @ts-expect-error
  expect(l.rectangles.size).toBe(2)
})
