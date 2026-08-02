import { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ trackId: `t${i}` }))

describe('syntenyTrackPalette', () => {
  test('has no greys', () => {
    // a grey ribbon reads as "uncolored/broken" rather than as a track identity
    for (const hex of syntenyTrackPalette) {
      const [r, g, b] = [1, 3, 5].map(i =>
        Number.parseInt(hex.slice(i, i + 2), 16),
      ) as [number, number, number]
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(20)
    }
  })

  test('entries are unique', () => {
    expect(new Set(syntenyTrackPalette).size).toBe(syntenyTrackPalette.length)
  })
})

describe('assignTrackColors', () => {
  test('hands out distinct colors in palette order', () => {
    const got = assignTrackColors(ids(3))
    expect([...got.values()]).toEqual(syntenyTrackPalette.slice(0, 3))
  })

  test('an automatic slot never duplicates a pinned color', () => {
    // t1 pins what t1 would have taken anyway; t0 and t2 must route around it
    const pinned = syntenyTrackPalette[1]!
    const got = assignTrackColors([
      { trackId: 't0' },
      { trackId: 't1', color: pinned },
      { trackId: 't2' },
    ])
    expect(got.get('t1')).toBe(pinned)
    expect(got.get('t0')).not.toBe(pinned)
    expect(got.get('t2')).not.toBe(pinned)
    expect(got.get('t0')).not.toBe(got.get('t2'))
  })

  test('a pin taken from further down the palette is still skipped', () => {
    const pinned = syntenyTrackPalette[0]!
    const got = assignTrackColors([
      { trackId: 't0' },
      { trackId: 't1', color: pinned },
    ])
    expect(got.get('t0')).toBe(syntenyTrackPalette[1])
  })

  test('wraps rather than running out', () => {
    const n = syntenyTrackPalette.length + 2
    const got = assignTrackColors(ids(n))
    expect(got.size).toBe(n)
    expect(got.get(`t${syntenyTrackPalette.length}`)).toBe(
      syntenyTrackPalette[0],
    )
  })

  test('terminates when every palette entry is pinned', () => {
    const tracks = [
      ...syntenyTrackPalette.map((color, i) => ({ trackId: `p${i}`, color })),
      { trackId: 'auto' },
    ]
    const got = assignTrackColors(tracks)
    expect(got.get('auto')).toBeDefined()
  })

  test('removing a middle track reshuffles the ones after it', () => {
    // documented tradeoff: the assignment is positional, not an identity
    const before = assignTrackColors(ids(3))
    const after = assignTrackColors([{ trackId: 't0' }, { trackId: 't2' }])
    expect(after.get('t0')).toBe(before.get('t0'))
    expect(after.get('t2')).not.toBe(before.get('t2'))
  })
})
