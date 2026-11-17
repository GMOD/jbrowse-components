import { SimpleFeature } from '@jbrowse/core/util'

import { NO_OPS } from './alignmentOps.ts'
import { windowGroupsOn } from './laneStage.ts'
import { groupFeatures } from './layoutMultiWay.ts'

test('a group spelled by an alias meets the window under its canonical name', () => {
  const groups = groupFeatures([
    new SimpleFeature({
      uniqueId: 'g',
      refName: 'A',
      start: 50,
      end: 1500,
      strand: 1,
      assemblyName: 'anchor',
      mate: { assemblyName: 'peach', refName: 'Pp1', start: 0, end: 1450 },
    }),
  ])
  const { shown, fit } = windowGroupsOn(
    {
      layout: {
        displayedRegions: [
          { assemblyName: 'anchor', refName: 'ctgA', start: 0, end: 1000 },
        ],
        bpPerPx: 1,
        offsetPx: 0,
      },
      canon: refName => (refName === 'A' ? 'ctgA' : refName),
    },
    groups,
    [{ refName: 'ctgA', start: 100, end: 500 }],
    NO_OPS,
  )
  expect(shown.map(g => [g.anchor.start, g.anchor.end])).toEqual([[50, 1000]])
  expect(fit.map(g => [g.anchor.start, g.anchor.end])).toEqual([[100, 500]])
})
