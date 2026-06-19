import PluginManager from '@jbrowse/core/PluginManager'

import MigrateMultiWiggleConfigF from './preProcessTrackConfig.ts'

interface DisplaySnapshot {
  type?: string
  defaultRendering?: string
}
interface TrackConfigSnapshot {
  type?: string
  trackId?: string
  displays?: DisplaySnapshot[]
}

function evaluate(snap: TrackConfigSnapshot) {
  const pm = new PluginManager()
  MigrateMultiWiggleConfigF(pm)
  return pm.evaluateExtensionPoint(
    'Core-preProcessTrackConfig',
    snap,
  ) as TrackConfigSnapshot
}

test('remaps a legacy single-source defaultRendering to its multi equivalent', () => {
  const out = evaluate({
    type: 'MultiQuantitativeTrack',
    trackId: 't1',
    displays: [{ type: 'MultiLinearWiggleDisplay', defaultRendering: 'xyplot' }],
  })
  expect(out.displays![0]!.defaultRendering).toBe('multixyplot')
})

test('leaves an already-multi defaultRendering untouched', () => {
  const out = evaluate({
    type: 'MultiQuantitativeTrack',
    trackId: 't1',
    displays: [
      { type: 'MultiLinearWiggleDisplay', defaultRendering: 'multiline' },
    ],
  })
  expect(out.displays![0]!.defaultRendering).toBe('multiline')
})

test('does not touch single-source wiggle displays (xyplot stays valid there)', () => {
  const out = evaluate({
    type: 'QuantitativeTrack',
    trackId: 't1',
    displays: [{ type: 'LinearWiggleDisplay', defaultRendering: 'xyplot' }],
  })
  expect(out.displays![0]!.defaultRendering).toBe('xyplot')
})

test('passes through track configs with no displays array', () => {
  const out = evaluate({ type: 'FeatureTrack', trackId: 't1' })
  expect(out.displays).toBeUndefined()
})
