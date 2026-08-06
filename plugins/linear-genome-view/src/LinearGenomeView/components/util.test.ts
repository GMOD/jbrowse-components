import { createOverviewLayout } from '@jbrowse/core/util/Base1DUtils'

import { overviewPxToBp } from './util.ts'

// 1000bp shown in 100px of overview, sitting to the right of a 40px gutter that
// the chromosome name is drawn in — the geometry cytobandOffset produces
const CYTOBAND_OFFSET = 40
const overview = createOverviewLayout({
  displayedRegions: [
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
  ],
  width: 100,
})

describe('overviewPxToBp', () => {
  test('reads out the bp under a pixel of the strip', () => {
    expect(
      overviewPxToBp(overview, CYTOBAND_OFFSET + 50, CYTOBAND_OFFSET),
    ).toMatchObject({
      refName: 'ctgA',
      coord: 501,
      oob: false,
    })
  })

  // the strip spans the whole view, so these pixels are hoverable and clickable
  // even though the overview layout does not start until after them
  test('the chromosome-name gutter reads as the genome start, not a negative coord', () => {
    for (const x of [0, 1, CYTOBAND_OFFSET - 1]) {
      expect(overviewPxToBp(overview, x, CYTOBAND_OFFSET)).toMatchObject({
        refName: 'ctgA',
        coord: 1,
        oob: false,
      })
    }
  })

  test('the far right edge reads as the last base, not past the end', () => {
    expect(
      overviewPxToBp(overview, CYTOBAND_OFFSET + 100, CYTOBAND_OFFSET),
    ).toMatchObject({
      refName: 'ctgA',
      coord: 991,
      oob: false,
    })
  })
})
