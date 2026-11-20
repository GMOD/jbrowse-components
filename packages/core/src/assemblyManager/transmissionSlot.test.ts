import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { createBaseTrackConfig } from '../pluggableElementTypes/models/baseTrackConfig.ts'
import assemblyConfigSchema from './assemblyConfigSchema.ts'
import { transmissionEntriesFor } from './transmission.ts'

function assemblyConfig(transmission?: unknown) {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'RefNameAliasAdapter',
        configSchema: ConfigurationSchema(
          'RefNameAliasAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => {
          throw new Error('no adapter is instantiated in this test')
        },
      }),
  )
  pluginManager.addTrackType(
    () =>
      new TrackType({
        name: 'ReferenceSequenceTrack',
        configSchema: ConfigurationSchema(
          'ReferenceSequenceTrack',
          {},
          {
            baseConfiguration: createBaseTrackConfig(pluginManager),
            explicitIdentifier: 'trackId',
          },
        ),
        stateModel: types.model('ReferenceSequenceTrack', {}),
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return assemblyConfigSchema(pluginManager).create({
    name: 'hg38',
    ...(transmission === undefined ? {} : { transmission }),
  })
}

test("an assembly's transmission defaults to no entries", () => {
  const conf = assemblyConfig()

  expect(conf.transmission.length).toBe(0)
  expect(getSnapshot(conf)).not.toHaveProperty('transmission')
})

test('an entry with no from reads as either', () => {
  const conf = assemblyConfig([
    { refName: 'chrX', sex: 'male', from: 'mother' },
    { refName: 'chrM' },
  ])
  const [mito] = transmissionEntriesFor(conf.transmission, 'chrM', {
    getCanonicalRefName2: refName => refName,
  })

  expect(mito?.refName).toBe('chrM')
  expect(mito?.sex).toBeUndefined()
  expect(mito?.from).toBe('either')
})

test('an entry naming a parent the slot does not know is refused', () => {
  expect(() =>
    assemblyConfig([{ refName: 'chrX', sex: 'male', from: 'mom' }]),
  ).toThrow(/mom/)
})

test('an entry with a key the slot does not declare loads without it, named', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const conf = assemblyConfig([{ refName: 'chrX', parent: 'mother' }])

  expect(getSnapshot(conf.transmission)).toEqual([{ refName: 'chrX' }])
  expect(warn).toHaveBeenCalledWith(
    'TransmissionEntry does not declare parent: loading without it',
  )
  warn.mockRestore()
})
