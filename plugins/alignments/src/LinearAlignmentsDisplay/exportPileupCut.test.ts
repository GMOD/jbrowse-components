import { exportPileupCut } from './exportPileupCut.ts'

const ROW = 10

function section(pileupTop: number, rows: number, ceilingClipped = false) {
  return {
    pileupTop,
    pileupHeight: rows * ROW,
    rowsHeight: rows * ROW,
    ceilingClipped,
  }
}

const NONE = { cutY: 200, caption: '' }

const ungrouped = (canvasHeight: number, scrollTop = 0) => ({
  isGrouped: false,
  scrollTop,
  canvasHeight,
})
const grouped = (canvasHeight: number, scrollTop = 0) => ({
  isGrouped: true,
  scrollTop,
  canvasHeight,
})

describe('a pileup that fits', () => {
  it('has no cut', () => {
    expect(exportPileupCut([section(40, 10)], ROW, ungrouped(200))).toEqual(
      NONE,
    )
  })

  it('has none where the rows end exactly at the box', () => {
    expect(exportPileupCut([section(40, 16)], ROW, ungrouped(200))).toEqual(
      NONE,
    )
  })

  it('has none where fitted rows of a fractional pitch fill the box', () => {
    const pitch = 100 / 22
    const fitted = {
      pileupTop: 0,
      pileupHeight: 22 * pitch,
      rowsHeight: 22 * pitch,
      ceilingClipped: false,
    }
    expect(exportPileupCut([fitted], pitch, ungrouped(100))).toEqual({
      cutY: 100,
      caption: '',
    })
  })

  it('has none where a drag padded the band past the box but the rows fit', () => {
    expect(
      exportPileupCut(
        [{ ...section(40, 10), pileupHeight: 400 }],
        ROW,
        ungrouped(200),
      ),
    ).toEqual(NONE)
  })
})

describe('a pileup deeper than the box', () => {
  // Rows from y=40 at 10px: the box at 205 cuts row 16 (200-210) half-way.
  it('ends on the last whole row above the caption line and counts the rest', () => {
    expect(exportPileupCut([section(40, 30)], ROW, ungrouped(205))).toEqual({
      cutY: 190,
      caption: '15 more rows below',
    })
  })

  it('counts one row cut by the box alone as a row below', () => {
    expect(
      exportPileupCut([section(40, 17)], ROW, ungrouped(205)).caption,
    ).toBe('2 more rows below')
  })

  // Ungrouped, the rows scroll under the sticky coverage band.
  it('scrolled, counts the rows under the band above', () => {
    expect(exportPileupCut([section(40, 30)], ROW, ungrouped(205, 50))).toEqual(
      { cutY: 190, caption: '5 rows above · 10 more rows below' },
    )
  })

  it('scrolled to its end, counts the rows above alone', () => {
    expect(exportPileupCut([section(40, 20)], ROW, ungrouped(205, 50))).toEqual(
      { cutY: 192, caption: '5 rows above' },
    )
  })
})

describe('a pileup the layout ceiling cut', () => {
  it('says so where its rows fit the box', () => {
    expect(
      exportPileupCut([section(40, 10, true)], ROW, ungrouped(205)),
    ).toEqual({ cutY: 192, caption: 'deeper reads are not stacked' })
  })

  it('says so after the rows left below', () => {
    expect(
      exportPileupCut([section(40, 30, true)], ROW, ungrouped(205)).caption,
    ).toBe('15 more rows below · deeper reads are not stacked')
  })
})

describe('a box too short for a whole row over the caption line', () => {
  // The rows start at 40; a 50px box leaves 37px above the caption line, under
  // the first row's 50px bottom.
  it('is not cut, though its rows run past it', () => {
    expect(exportPileupCut([section(40, 30)], ROW, ungrouped(50))).toEqual({
      cutY: 50,
      caption: '',
    })
  })

  it('is not cut where the caption line would start above the pileup', () => {
    expect(
      exportPileupCut([section(40, 30, true)], ROW, ungrouped(45)),
    ).toEqual({ cutY: 45, caption: '' })
  })
})

describe('grouped sections', () => {
  // The first ends at 140, whole; the second's rows run from 180, and the box
  // at 300 cuts its row 12.
  const sections = [section(40, 10), section(180, 20)]

  it('the section the box cuts ends on a whole row, the one above it as laid out', () => {
    expect(exportPileupCut(sections, ROW, grouped(300))).toEqual({
      cutY: 280,
      caption: '10 more rows below',
    })
  })

  it('a section wholly below the box counts all its rows', () => {
    expect(
      exportPileupCut([...sections, section(500, 7)], ROW, grouped(300))
        .caption,
    ).toBe('17 more rows below')
  })

  it('scrolled, a section above the box counts its rows above', () => {
    expect(exportPileupCut(sections, ROW, grouped(300, 150))).toEqual({
      cutY: 287,
      caption: '10 rows above',
    })
  })
})
