import { DEAL_COLOR_DIFFERENCE, colorDifference } from '@jbrowse/core/ui/colors'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'

import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function display(transcriptFeatures?: unknown) {
  const { createDisplay } = createTestEnvironment({
    displayConfig: transcriptFeatures ? { transcriptFeatures } : undefined,
  })
  return createDisplay().display
}

test('a region whose track failed lists the notice once', () => {
  const d = display(['test_track'])
  const notices = ['transcriptFeatures: HTTP 404']
  d.setRpcData(0, makeFeatureData({ notices }), ctgA)
  d.setRpcData(1, makeFeatureData({ notices }), ctgA)
  expect(d.notices).toEqual(notices)
})

test('an entry naming no track says so, and the rest still draw', () => {
  const d = display(['nope', { track: 'test_track', on: 'exon' }])
  expect(d.notices).toEqual([
    'transcriptFeatures: no track "nope" with an adapter',
  ])
  expect(d.transcriptFeaturesArg?.tracks.map(t => [t.trackId, t.on])).toEqual([
    ['test_track', 'exon'],
  ])
})

test('a display with no transcriptFeatures has no notice', () => {
  expect(display().notices).toEqual([])
  expect(display(['test_track']).notices).toEqual([])
})

test('no row takes a color that reads as the CDS or UTR fill under it', () => {
  const d = display(['test_track'])
  const values = Array.from({ length: 30 }, (_, i) => `PF${i}`)
  const near = values
    .map(value => d.domainPalette!.paint(value))
    .filter(color =>
      [featureDefaultColor, utrDefaultColor].some(
        fill => colorDifference(color, fill) < DEAL_COLOR_DIFFERENCE,
      ),
    )
  expect(d.featureColor).toBe(featureDefaultColor)
  expect(near).toEqual([])
})
