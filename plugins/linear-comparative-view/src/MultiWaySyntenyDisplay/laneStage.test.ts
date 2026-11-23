import { SimpleFeature } from '@jbrowse/core/util'

import { NO_OPS } from './alignmentOps.ts'
import { canvasBlocks, windowGroupsOn } from './laneStage.ts'
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

// the 1388 px view of SV-ins-10k-100k, whose canvas the track outline makes
// 1386 px, at 19.54 bp per px
test('the fit stops at the canvas edge, short of the view by the track outline', () => {
  const bpPerPx = 27_125 / 1388
  const block = {
    refName: 'chr22',
    start: 23_988_272,
    end: 24_015_397,
    offsetPx: 1_227_500,
    widthPx: 1388,
  }
  const [cut] = canvasBlocks([block], block.offsetPx + 1386, bpPerPx)
  expect(cut!.end - cut!.start).toBeCloseTo(1386 * bpPerPx, 6)
  expect(cut!.start).toBe(block.start)
  const [turned] = canvasBlocks(
    [{ ...block, reversed: true }],
    block.offsetPx + 1386,
    bpPerPx,
  )
  expect(turned!.end).toBe(block.end)
  expect(turned!.end - turned!.start).toBeCloseTo(1386 * bpPerPx, 6)
  expect(canvasBlocks([block], block.offsetPx + 1400, bpPerPx)).toEqual([block])
  expect(canvasBlocks([block], block.offsetPx, bpPerPx)).toEqual([])
})
