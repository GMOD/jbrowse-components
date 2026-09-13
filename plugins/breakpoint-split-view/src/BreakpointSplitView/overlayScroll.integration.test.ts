import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// The SVG export draws each track body at its scroll, so the connectors it
// overlays have to read the same scroll. They used to zero it whenever the
// export's fixed track tops were passed, landing every connector at the
// unscrolled row while the reads it joins sat higher.
test('export track tops keep each row’s scroll', async () => {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'volvox-ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  session.addSessionTrackConf({
    trackId: 'feats',
    type: 'FeatureTrack',
    name: 'feats',
    assemblyNames: ['volvox'],
    // enough overlapping features to stack past the display's height, so it
    // has somewhere to scroll
    adapter: {
      type: 'FromConfigAdapter',
      features: Array.from({ length: 40 }, (_, i) => ({
        uniqueId: `f${i}`,
        refName: 'ctgA',
        start: 100,
        end: 900,
      })),
    },
  })
  const view = (await session.launchView('BreakpointSplitView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:1-1000', tracks: ['feats'] },
      { assembly: 'volvox', loc: 'ctgA:2000-3000', tracks: ['feats'] },
    ],
  })) as unknown as BreakpointViewModel
  view.setWidth(800)
  await when(() => view.views.every(v => v.tracks.length === 1))

  const display = view.views[0]!.tracks[0]!.displays[0]! as {
    scrollableHeight: number
    setScrollTop: (n: number) => void
  }
  await when(() => display.scrollableHeight > 40, { timeout: 20000 })
  display.setScrollTop(40)

  const { levels } = view.getTrackOverlayData('feats', [100, 500])
  expect(levels.map(l => l.scrollTop)).toEqual([40, 0])
  expect(levels.map(l => l.yOffset)).toEqual([100, 500])
}, 30000)
