import {
  bandOnScreen,
  bandScreenTop,
  contentScreenY,
  sectionBandBottom,
} from './sectionScreen.ts'

const ungrouped = { isGrouped: false, scrollTop: 40, canvasHeight: 600 }
const grouped = { isGrouped: true, scrollTop: 40, canvasHeight: 600 }

describe('bandScreenTop: sticky-capable tier', () => {
  it('ignores scroll when ungrouped (sticky coverage/arc/sashimi band)', () => {
    expect(bandScreenTop(100, ungrouped)).toBe(100)
  })
  it('scrolls with its section when grouped', () => {
    expect(bandScreenTop(100, grouped)).toBe(60)
  })
})

describe('contentScreenY: always-scrolling pileup tier', () => {
  it('subtracts scroll in both modes (ungrouped scrolls under sticky coverage)', () => {
    expect(contentScreenY(100, ungrouped)).toBe(60)
    expect(contentScreenY(100, grouped)).toBe(60)
  })
})

describe('sectionBandBottom', () => {
  it('is the content-space pileup bottom, scroll-subtracted and canvas-clamped', () => {
    // pileupTop 100 + height 200 = 300 content; minus scroll 40 = 260.
    expect(sectionBandBottom(100, 200, grouped)).toBe(260)
    // Clamp to the canvas height when the band runs past the bottom.
    expect(sectionBandBottom(100, 2000, grouped)).toBe(600)
  })
  it('collapses to the band top for a collapsed group (height 0)', () => {
    expect(sectionBandBottom(100, 0, grouped)).toBe(bandScreenTop(100, grouped))
  })
})

describe('bandOnScreen', () => {
  it('is true when the band intersects [0, canvasHeight]', () => {
    expect(bandOnScreen(10, 50, grouped)).toBe(true)
    expect(bandOnScreen(-50, 60, grouped)).toBe(true) // bottom edge at 10
    expect(bandOnScreen(600, 20, grouped)).toBe(true) // top edge exactly at canvas bottom
  })
  it('is false when the band is fully above or below the canvas', () => {
    expect(bandOnScreen(-60, 50, grouped)).toBe(false) // bottom at -10
    expect(bandOnScreen(601, 20, grouped)).toBe(false)
  })
})
