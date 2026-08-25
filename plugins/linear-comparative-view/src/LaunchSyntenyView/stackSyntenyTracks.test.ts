import { createPanelStack } from '../LGVSyntenyDisplay/testEnv.ts'
import { launchableTrackConfs } from './stackSyntenyTracks.ts'

const band = { configuration: { trackId: 'band_paf' } }

// A band's track lives on the stack's level, not in any row, so a row's own
// track list never held the dataset that put it there — and the rubberband on
// a launched stack offered no synteny launch at all.
test('a row of a stack launches from the bands beside it', () => {
  const { panels } = createPanelStack({ levelTracks: [band] })
  expect(launchableTrackConfs(panels[0]!)).toEqual([band.configuration])
  expect(launchableTrackConfs(panels[1]!)).toEqual([band.configuration])
})

test('a standalone view launches from its own tracks only', () => {
  const { standalone } = createPanelStack({ levelTracks: [band] })
  expect(launchableTrackConfs(standalone)).toEqual([])
})
