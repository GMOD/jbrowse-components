import {
  bandScreenTop,
  contentScreenY,
  onPileupBand,
  pileupRowsOnScreen,
  sectionBandBottom,
} from './sectionScreen.ts'

const ungrouped = { isGrouped: false, scrollTop: 40, canvasHeight: 600 }
const grouped = { isGrouped: true, scrollTop: 40, canvasHeight: 600 }

describe('bandScreenTop: sticky-capable tier', () => {
  it('ignores scroll when ungrouped (sticky coverage/arc/junctions band)', () => {
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

describe('onPileupBand', () => {
  const section = { pileupTop: 90, pileupHeight: 400 }
  it('excludes the sticky strips an ungrouped pileup scrolls under', () => {
    const scrolled = { isGrouped: false, scrollTop: 120, canvasHeight: 600 }
    expect(onPileupBand(section, 70, scrolled)).toBe(false)
    expect(onPileupBand(section, 90, scrolled)).toBe(true)
  })
  it('stops at the band bottom', () => {
    expect(onPileupBand(section, 449, ungrouped)).toBe(true)
    expect(onPileupBand(section, 450, ungrouped)).toBe(false)
  })
  it('is empty for a collapsed band', () => {
    expect(onPileupBand({ pileupTop: 90, pileupHeight: 0 }, 90, grouped)).toBe(
      false,
    )
  })
})

describe('pileupRowsOnScreen', () => {
  it('runs from the row under the clip ceiling to the one the canvas cuts', () => {
    // ungrouped: rows scroll 40 px under a ceiling at 100, the canvas ends at 600
    expect(
      pileupRowsOnScreen({ pileupTop: 100, pileupHeight: 2000 }, 10, ungrouped),
    ).toEqual({ first: 4, last: 53 })
  })
  it('ends at the band bottom when the rows run out first', () => {
    expect(
      pileupRowsOnScreen({ pileupTop: 100, pileupHeight: 95 }, 10, grouped),
    ).toEqual({ first: 0, last: 9 })
  })
  it('is empty for a collapsed lane', () => {
    const { first, last } = pileupRowsOnScreen(
      { pileupTop: 100, pileupHeight: 0 },
      10,
      grouped,
    )
    expect(last).toBeLessThan(first)
  })
})
