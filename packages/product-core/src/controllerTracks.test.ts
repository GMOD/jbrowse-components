import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import {
  isLooseTrack,
  resolveTracks,
  withAssemblyName,
} from './controllerTracks.ts'
import { registerLocalFiles } from './localFiles.ts'

test('stamps the assembly name onto a config that omits assemblyNames', () => {
  expect(
    withAssemblyName({ type: 'FeatureTrack', trackId: 't' }, 'volvox'),
  ).toEqual({ type: 'FeatureTrack', trackId: 't', assemblyNames: ['volvox'] })
})

test('leaves an existing assemblyNames untouched', () => {
  const track = { trackId: 't', assemblyNames: ['hg38'] }
  expect(withAssemblyName(track, 'volvox')).toBe(track)
})

test('no-ops when the assembly name is unresolved', () => {
  const track = { trackId: 't' }
  expect(withAssemblyName(track, undefined)).toBe(track)
})

test('a bare URL and a { uri } object are loose; a full config is not', () => {
  expect(isLooseTrack('peaks.bed.gz')).toBe(true)
  expect(isLooseTrack({ uri: 'peaks.bed.gz', index: 'peaks.bed.gz.tbi' })).toBe(
    true,
  )
  expect(isLooseTrack({ trackId: 't', adapter: { type: 'X', uri: 'y' } })).toBe(
    false,
  )
  expect(isLooseTrack({ trackId: 't', uri: 42 })).toBe(false)
})

function sessionWithShorthandAdapter() {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ShorthandAdapter',
        configSchema: ConfigurationSchema(
          'ShorthandAdapter',
          { dataLocation: { type: 'fileLocation', defaultValue: { uri: '' } } },
          {
            explicitlyTyped: true,
            preProcessSnapshot: (snap: Record<string, unknown>) =>
              snap.uri ? { ...snap, dataLocation: { uri: snap.uri } } : snap,
          },
        ),
        getAdapterClass: () => {
          throw new Error('no adapter is instantiated in this test')
        },
      }),
  )
  pluginManager.createPluggableElements()
  return types
    .model({})
    .views(() => ({
      get view() {
        return { tracks: [], launchTrack: async () => {}, hideTrack: () => {} }
      },
      getTrackById: () => undefined,
      addSessionTrackConf: () => {},
    }))
    .create({}, { pluginManager })
}

test('a shorthand adapter in a track reads its registered local file', () => {
  const localFiles = registerLocalFiles({ 'x.dat': new Uint8Array([1]) })

  const [conf] = resolveTracks(
    [
      {
        type: 'FeatureTrack',
        trackId: 't',
        adapter: { type: 'ShorthandAdapter', uri: 'x.dat' },
      },
    ],
    sessionWithShorthandAdapter(),
    'volvox',
    localFiles,
  )

  expect(conf).toMatchObject({
    adapter: { type: 'ShorthandAdapter', dataLocation: localFiles['x.dat'] },
  })
})
