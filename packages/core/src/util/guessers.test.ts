import PluginManager from '../PluginManager.ts'
import {
  addAdapterGuesser,
  addTrackTypeGuesser,
  getFileName,
} from './tracks.ts'

import type { FileLocation } from './types/data.ts'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

function setup() {
  const pm = new PluginManager([])
  return {
    pm,
    adapterGuess: () =>
      pm.evaluateExtensionPoint(
        'Core-guessAdapterForLocation',
        () => undefined,
      ),
    trackTypeGuess: () =>
      pm.evaluateExtensionPoint(
        'Core-guessTrackTypeForLocation',
        () => undefined,
      ),
  }
}

test('a declining guesser defers to the one registered before it', () => {
  const { pm, adapterGuess } = setup()
  addAdapterGuesser(pm, file =>
    getFileName(file).endsWith('.bam') ? { type: 'BamAdapter' } : undefined,
  )
  addAdapterGuesser(pm, () => undefined)
  expect(adapterGuess()(uri('x.bam'))?.type).toBe('BamAdapter')
})

test('the last-registered guesser wins over an earlier match', () => {
  const { pm, adapterGuess } = setup()
  addAdapterGuesser(pm, () => ({ type: 'First' }))
  addAdapterGuesser(pm, () => ({ type: 'Second' }))
  expect(adapterGuess()(uri('x'))?.type).toBe('Second')
})

// a hand-written delegate used to call `next(adapterName)`, so an optional
// `file` never reached the guessers registered before it — .bedmethyl.gz then
// resolved to FeatureTrack instead of MultiQuantitativeTrack
test('the optional file arg survives a declining guesser', () => {
  const { pm, trackTypeGuess } = setup()
  addTrackTypeGuesser(pm, (adapterName, file) =>
    file ? `saw-file-${adapterName}` : undefined,
  )
  addTrackTypeGuesser(pm, () => undefined)
  expect(trackTypeGuess()('BedTabixAdapter', uri('x.bedmethyl.gz'))).toBe(
    'saw-file-BedTabixAdapter',
  )
})
