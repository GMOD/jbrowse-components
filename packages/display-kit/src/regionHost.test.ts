import { contentRightEdgePx } from './regionHost.ts'

describe('contentRightEdgePx', () => {
  test('pins to the last visible content block, off a trailing padding block', () => {
    // whole-genome view: content ends at 1400 but the track is 1500 wide (the
    // trailing 100px is a region-separator/elided PaddingBlock that would mask a
    // 1500-pinned legend)
    const regions = [{ screenEndPx: 700 }, { screenEndPx: 1400 }]
    expect(contentRightEdgePx(regions, 1500)).toBe(1400)
  })

  test('clamps to the width when content overflows (scrolled/zoomed in)', () => {
    expect(contentRightEdgePx([{ screenEndPx: 3000 }], 1500)).toBe(1500)
  })

  test('falls back to the width with no visible regions', () => {
    expect(contentRightEdgePx([], 1500)).toBe(1500)
  })

  // What makes the view's getter worth publishing: the clamp has to happen
  // INSIDE the computed, or MobX has nothing to stop at. Content that overflows
  // the track — every zoom level where the genome is wider than the viewport,
  // i.e. the common case — gives the same number as the blocks move underneath.
  test('is unchanged across frames while content overflows', () => {
    const frames = [3000, 2600, 2260, 1966, 1710].map(screenEndPx =>
      contentRightEdgePx([{ screenEndPx }], 1500),
    )
    expect(new Set(frames).size).toBe(1)
  })
})
