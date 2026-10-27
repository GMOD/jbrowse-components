import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import { ribbonPaintOf } from './ribbonPaint.ts'

const record = new SimpleFeature({
  uniqueId: 'r1',
  refName: 'chr1',
  start: 0,
  end: 100,
})

// a record that joins pairs of either strand: an anchor run against a lane's
// forward and inverted runs
test('one record paints and filters each pair by its own strand', () => {
  const paintOf = (filter = [] as { field: string; equal: number }[]) =>
    ribbonPaintOf({
      records: [record],
      field: 'strand',
      ribbonColor: 'grey',
      attributeRanges: {},
      opacity: { value: 1 },
      filter,
    })
  const [forward, reverse] = UNIVERSAL_FIELD_PRESETS.strand.scale.range.map(c =>
    withAbgrAlpha(cssColorToABGR(c), 255),
  )
  const paint = paintOf()
  expect([paint(record, 1), paint(record, -1), paint(record, 1)]).toEqual([
    forward,
    reverse,
    forward,
  ])
  const forwardOnly = paintOf([{ field: 'strand', equal: 1 }])
  expect([forwardOnly(record, -1), forwardOnly(record, 1)]).toEqual([
    undefined,
    forward,
  ])
})
