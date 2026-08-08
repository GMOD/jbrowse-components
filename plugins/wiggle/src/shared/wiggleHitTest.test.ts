import { hitTestMouse } from './wiggleHitTest.ts'

describe('hitTestMouse', () => {
  // 100px of screen over 10bp → 10px per base, so each base's pixels are
  // unambiguous and an off-by-half-base shows up directly.
  const region = {
    refName: 'chr1',
    screenStartPx: 0,
    screenEndPx: 100,
    start: 1000,
    end: 1010,
    displayedRegionIndex: 0,
  }
  const data = new Map([[0, 'data']])

  test('returns undefined outside any region', () => {
    expect(hitTestMouse([region], data, -1)).toBeUndefined()
    expect(hitTestMouse([region], data, 100)).toBeUndefined()
  })

  test('returns undefined when the region has no data loaded', () => {
    expect(hitTestMouse([region], new Map(), 50)).toBeUndefined()
  })

  test('reports the base under the cursor across its whole pixel span', () => {
    // Every pixel of base 1000's 10px span reports 1000 — including the right
    // half, which a round() mapping would push onto 1001.
    expect(hitTestMouse([region], data, 0)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 4)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 5)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 9)?.bp).toBe(1000)
    expect(hitTestMouse([region], data, 10)?.bp).toBe(1001)
  })

  test('never reports the exclusive region end', () => {
    expect(hitTestMouse([region], data, 99)?.bp).toBe(1009)
  })

  test('reversed regions run right to left', () => {
    const rev = { ...region, reversed: true }
    // Leftmost pixel is the region's last base, not its exclusive end.
    expect(hitTestMouse([rev], data, 0)?.bp).toBe(1009)
    expect(hitTestMouse([rev], data, 9)?.bp).toBe(1009)
    expect(hitTestMouse([rev], data, 10)?.bp).toBe(1008)
    expect(hitTestMouse([rev], data, 99)?.bp).toBe(1000)
  })

  test('picks the region containing x and returns its data', () => {
    const second = {
      ...region,
      screenStartPx: 100,
      screenEndPx: 200,
      start: 2000,
      end: 2010,
      displayedRegionIndex: 1,
    }
    const map = new Map([
      [0, 'first'],
      [1, 'second'],
    ])
    const hit = hitTestMouse([region, second], map, 150)
    expect(hit?.data).toBe('second')
    expect(hit?.bp).toBe(2005)
  })
})
