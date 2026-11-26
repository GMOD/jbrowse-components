import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { linkFeet } from '@jbrowse/render-core/marks'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcCategoryColor } from '../../shaders/palettes.ts'
import { buildJunctionsBandFeeds } from './bandFeed.ts'
import { junctionKey } from './junctions.ts'

import type { JunctionSplitClass } from './junctionClass.ts'
import type { MergedJunction } from './junctions.ts'

function junction(
  start: number,
  end: number,
  split?: JunctionSplitClass,
): MergedJunction {
  return {
    key: junctionKey('chr1', start, end, split),
    refName: 'chr1',
    start,
    end,
    count: 5,
    strand: split ? 0 : -1,
    motif: 0,
    split,
    inRead: false,
  }
}

test('a split junction paints its read arc color, a splice junction its strand', () => {
  const colors = makeTestPalette()
  const feeds = buildJunctionsBandFeeds({
    junctions: [
      junction(100, 500),
      junction(200, 900, 'splitBack'),
      junction(300, 400, 'splitForward'),
    ],
    downJunctionKeys: new Set(),
    displayed: [
      { refName: 'chr1', start: 0, end: 10_000, displayedRegionIndex: 0 },
    ],
    colors,
  })
  const feed = feeds.get(0)!
  expect([...(feed.up.color as Uint32Array)]).toEqual([
    normalizedRgbToABGR(...colors.colorRevStrand),
    normalizedRgbToABGR(...arcCategoryColor(colors, 'splitBack')),
    normalizedRgbToABGR(...arcCategoryColor(colors, 'splitForward')),
  ])
  expect(arcCategoryColor(colors, 'splitBack')).toEqual(
    colors.readCategoryColors.pairRL,
  )
})

test('a split junction draws the feet its class names, a splice junction none', () => {
  const feeds = buildJunctionsBandFeeds({
    junctions: [
      junction(100, 500),
      junction(200, 900, 'splitForward'),
      junction(300, 400, 'splitBack'),
      junction(400, 800, 'splitInvLL'),
      junction(500, 600, 'splitInvRR'),
    ],
    downJunctionKeys: new Set(),
    displayed: [
      { refName: 'chr1', start: 0, end: 10_000, displayedRegionIndex: 0 },
    ],
    colors: makeTestPalette(),
  })
  expect([...feeds.get(0)!.up.feet!]).toEqual([
    0,
    linkFeet(-1, 1),
    linkFeet(1, -1),
    linkFeet(-1, -1),
    linkFeet(1, 1),
  ])
})
