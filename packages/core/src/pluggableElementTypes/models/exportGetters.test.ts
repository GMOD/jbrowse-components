import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/index.ts'
import AdapterType from '../AdapterType.ts'
import TrackType from '../TrackType.ts'
import { createBaseTrackConfig, createBaseTrackModel } from './index.ts'

// The two getters "Save track data" reads off a track. Both answer from the
// adapter — one from its declared capabilities, one from its `fetchSizeLimit`
// slot — and neither is reachable from the dialog's own tests, which stand the
// track up as a plain object.
function adapter(
  name: string,
  {
    exportsData,
    fetchSizeLimit,
  }: { exportsData?: boolean; fetchSizeLimit?: number } = {},
) {
  return () =>
    new AdapterType({
      name,
      adapterCapabilities: exportsData ? ['exportData'] : [],
      configSchema: ConfigurationSchema(
        name,
        {
          uri: { type: 'string', defaultValue: '' },
          ...(fetchSizeLimit === undefined
            ? {}
            : {
                fetchSizeLimit: {
                  type: 'number',
                  defaultValue: fetchSizeLimit,
                },
              }),
        },
        { explicitlyTyped: true },
      ),
      getAdapterClass: () => Promise.reject(new Error('not instantiated')),
    })
}

function setup() {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    adapter('ExportingAdapter', {
      exportsData: true,
      fetchSizeLimit: 2_000_000,
    }),
  )
  pluginManager.addAdapterType(adapter('PlainAdapter'))
  pluginManager.addAdapterType(
    adapter('ZeroLimitAdapter', { fetchSizeLimit: 0 }),
  )
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        configSchema,
      ),
    })
  })
  pluginManager.createPluggableElements()
  pluginManager.configure()

  // the config goes in as a snapshot, so it instantiates inside the track's own
  // tree — a config created separately carries its own env and cannot be adopted
  return (adapterType: string) =>
    pluginManager.getTrackType('FeatureTrack').stateModel.create(
      {
        type: 'FeatureTrack',
        configuration: {
          trackId: `track-${adapterType}`,
          type: 'FeatureTrack',
          adapter: { type: adapterType },
        },
      },
      { pluginManager },
    )
}

test('exportsDataViaAdapter reads the adapter type’s declared capability', () => {
  const track = setup()
  expect(track('ExportingAdapter').exportsDataViaAdapter).toBe(true)
  expect(track('PlainAdapter').exportsDataViaAdapter).toBe(false)
})

test('exportByteLimit prefers the adapter’s declared limit', () => {
  expect(setup()('ExportingAdapter').exportByteLimit).toBe(2_000_000)
})

test('exportByteLimit falls back where the adapter declares none', () => {
  expect(setup()('PlainAdapter').exportByteLimit).toBe(5_000_000)
})

// A non-positive limit is "no opinion" rather than "refuse everything", the same
// reading resolveByteLimit gives it on the display's own gate.
test('exportByteLimit ignores a non-positive declared limit', () => {
  expect(setup()('ZeroLimitAdapter').exportByteLimit).toBe(5_000_000)
})
