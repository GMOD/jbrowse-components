import PluginManager from '@jbrowse/core/PluginManager'

import BedPlugin from '../index.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

function setup() {
  const pluginManager = new PluginManager([new BedPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const guessAdapter = pluginManager.evaluateExtensionPoint(
    'Core-guessAdapterForLocation',
    () => undefined,
  )
  const guessTrackType = pluginManager.evaluateExtensionPoint(
    'Core-guessTrackTypeForLocation',
    () => undefined,
  )
  return { guessAdapter, guessTrackType }
}

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

test.each([
  'volvox.star-fusion.tsv',
  'star-fusion.fusion_predictions.tsv',
  'sample.fusion_predictions.abridged.tsv',
  'volvox.star-fusion.tsv.gz',
])('guesses StarFusionAdapter for %s', name => {
  const { guessAdapter, guessTrackType } = setup()
  const adapter = guessAdapter(uri(name), undefined, undefined)
  expect(adapter?.type).toBe('StarFusionAdapter')
  expect(adapter?.starFusionLocation).toEqual(uri(name))
  expect(guessTrackType('StarFusionAdapter', uri(name))).toBe('VariantTrack')
})

test('a plain .tsv is not assumed to be StarFusion', () => {
  const { guessAdapter } = setup()
  expect(guessAdapter(uri('expression_matrix.tsv'), undefined, undefined)).toBe(
    undefined,
  )
})

test('honors an explicit StarFusionAdapter hint regardless of extension', () => {
  const { guessAdapter } = setup()
  const adapter = guessAdapter(
    uri('fusions.txt'),
    undefined,
    'StarFusionAdapter',
  )
  expect(adapter?.type).toBe('StarFusionAdapter')
})
