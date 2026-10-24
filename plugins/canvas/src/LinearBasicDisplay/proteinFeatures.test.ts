import { DEAL_COLOR_DIFFERENCE, colorDifference } from '@jbrowse/core/ui/colors'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'

import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

function display(proteinFeatures?: Record<string, unknown>) {
  const { createDisplay } = createTestEnvironment({
    displayConfig: proteinFeatures ? { proteinFeatures } : undefined,
  })
  return createDisplay().display
}

test('a region whose domains failed lists the notice once', () => {
  const d = display({ track: 'test_track' })
  const notices = ['proteinFeatures: HTTP 404']
  d.setRpcData(0, makeFeatureData({ notices }), ctgA)
  d.setRpcData(1, makeFeatureData({ notices }), ctgA)
  expect(d.notices).toEqual(notices)
})

test('a track naming no track says so', () => {
  expect(display({ track: 'nope' }).notices).toEqual([
    'proteinFeatures.track: no track "nope" with an adapter',
  ])
})

test('a display with no proteinFeatures has no notice', () => {
  expect(display().notices).toEqual([])
  expect(display({ track: 'test_track' }).notices).toEqual([])
})

test('no domain takes a color that reads as the CDS fill under it', () => {
  const d = display({ track: 'test_track' })
  const values = Array.from({ length: 30 }, (_, i) => `PF${i}`)
  const near = values
    .map(value => d.domainPalette!.paint(value))
    .filter(
      color => colorDifference(color, d.featureColor) < DEAL_COLOR_DIFFERENCE,
    )
  expect(d.featureColor).toBe(featureDefaultColor)
  expect(near).toEqual([])
})
