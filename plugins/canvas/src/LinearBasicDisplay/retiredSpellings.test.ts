import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'
import BedPlugin from '@jbrowse/plugin-bed'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import CanvasPlugin from '../index.ts'

// The display's whole migration is its schema's `preProcessSnapshot`, with no
// second registration on the DisplayType. Both cases below go through the
// track's `displays` union, which is a bare `types.union` with no dispatcher:
// a member's preprocessor runs while the union works out which display an
// entry is, so it reaches a legacy value in a constrained slot as well as a
// legacy key. Neutering the preprocessor fails both.
function basicDisplay(entry: Record<string, unknown>) {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new BedPlugin(),
    new CanvasPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const snapshot = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'FeatureTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BedTabixAdapter', uri: 'x.bed.gz' },
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: 't-LinearBasicDisplay',
        ...entry,
      },
    ],
  })
  const conf = pluginManager
    .getTrackType('FeatureTrack')
    .configSchema.create(snapshot, { pluginManager })
  return (conf.displays as { type: string }[]).find(
    d => d.type === 'LinearBasicDisplay',
  )!
}

test('a retired value in a constrained slot', () => {
  expect(
    readConfObject(basicDisplay({ displayMode: 'reducedRepresentation' }), [
      'displayMode',
    ]),
  ).toBe('normal')
})

test('a retired colour key', () => {
  expect(
    readConfObject(basicDisplay({ color1: 'red' }), ['color', 'value']),
  ).toBe('red')
})
