import SimpleFeature from '../../../util/simpleFeature.ts'
import { byPosition } from './util.ts'

import type { Feature } from '../../../util/simpleFeature.ts'

function feat(refName: string, start: number, source: string) {
  return new SimpleFeature({
    uniqueId: `${refName}-${start}-${source}`,
    refName,
    start,
    end: start + 10,
    source,
  })
}

const placed = (features: Feature[]) =>
  features.map(f => `${f.get('refName')}:${f.get('start')}:${f.get('source')}`)

// A multi-wiggle's subtracks are read concurrently, so its features arrive
// interleaved by subtrack and by region.
test('sorts by position within each sequence, sequences in arrival order', () => {
  expect(
    placed(
      byPosition([
        feat('ctgB', 0, 'a'),
        feat('ctgA', 10, 'a'),
        feat('ctgB', 0, 'b'),
        feat('ctgA', 0, 'b'),
      ]),
    ),
  ).toEqual(['ctgB:0:a', 'ctgB:0:b', 'ctgA:0:b', 'ctgA:10:a'])
})
