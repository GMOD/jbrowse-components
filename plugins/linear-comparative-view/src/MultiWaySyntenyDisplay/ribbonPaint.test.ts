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

// a lane joins many sequences, so the two-way views' sequence-name fields
// name nothing a ribbon could be colored by
test.each(['query', 'target', 'reference'])(
  '%s paints the ribbon color',
  field => {
    const paint = ribbonPaintOf({
      records: [record],
      field,
      ribbonColor: 'grey',
      attributeRanges: {},
      opacity: { value: 1 },
      filter: [],
    })
    expect(paint(record, 1)).toBe(cssColorToABGR('grey'))
  },
)

test('a ribbon its fade clears offers no hover target, as in two-way synteny', () => {
  const at = (identity: number) =>
    new SimpleFeature({ ...record.toJSON(), uniqueId: `${identity}`, identity })
  const [low, high] = [at(0.4), at(0.6)]
  const paint = ribbonPaintOf({
    records: [low, high],
    field: undefined,
    ribbonColor: 'grey',
    attributeRanges: { identity: { min: 0.4, max: 0.6 } },
    opacity: {
      field: 'identity',
      scale: { type: 'threshold', domain: ['0.5'], range: ['0', '0.5'] },
    },
    filter: [],
  })
  expect(paint(low, 1)).toBeUndefined()
  expect(paint(high, 1)).toBe(withAbgrAlpha(cssColorToABGR('grey'), 128))
})

test("a text column's missing value paints in the color scale.invalid names", () => {
  const paintOf = (paint = {}) =>
    ribbonPaintOf({
      records: [record],
      field: 'group',
      ribbonColor: 'grey',
      attributeRanges: { group: { labels: ['B1'], colors: {}, missing: true } },
      opacity: { value: 1 },
      filter: [],
      paint,
    })
  expect(paintOf()(record, 1)).toBe(cssColorToABGR('grey'))
  expect(paintOf({ invalid: 'gold' })(record, 1)).toBe(cssColorToABGR('gold'))
})
