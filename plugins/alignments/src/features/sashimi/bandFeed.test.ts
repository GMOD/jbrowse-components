import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { arcCategoryColor } from '../../shaders/palettes.ts'
import { buildSashimiBandFeeds } from './bandFeed.ts'
import { junctionKey } from './junctions.ts'

import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import type { MergedJunction } from './junctions.ts'

function junction(
  start: number,
  end: number,
  split?: ArcSplitCategory,
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
  }
}

test('a split junction paints its read arc color, a splice junction its strand', () => {
  const colors = makeTestPalette()
  const feeds = buildSashimiBandFeeds({
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
  expect([...feed.up.color]).toEqual([
    normalizedRgbToABGR(...colors.colorRevStrand),
    normalizedRgbToABGR(...arcCategoryColor(colors, 'splitBack')),
    normalizedRgbToABGR(...arcCategoryColor(colors, 'splitForward')),
  ])
  expect(arcCategoryColor(colors, 'splitBack')).toEqual(
    colors.readCategoryColors.pairRL,
  )
})
