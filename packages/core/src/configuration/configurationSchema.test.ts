import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { getConf, readConfObject } from './index.ts'
import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
import { isConfigurationModel } from './util.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

describe('configuration schemas', () => {
  test('can make a schema with a color', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Track', {
        backgroundColor: {
          description: "the track's background color",
          type: 'color',
          defaultValue: '#eee',
        },
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
      }),
    })

    const model = container.create(undefined, { pluginManager })

    expect(isConfigurationModel(model.configuration)).toBe(true)
    expect(getConf(model, 'backgroundColor')).toBe('#eee')
    expect(getConf(model, 'someInteger')).toBe(12)

    model.configuration.backgroundColor.set(`jexl:'#'+a`)
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('#zonk')
    expect(getConf(model, 'backgroundColor', { a: 'bar' })).toBe('#bar')
    model.configuration.backgroundColor.set('hoog')
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('hoog')

    model.configuration.someInteger.set('jexl:5+a')
    expect(getConf(model, 'someInteger', { a: 5 })).toBe(10)
    model.configuration.someInteger.set(42)
    expect(getConf(model, 'someInteger', { a: 5 })).toBe(42)

    // type "tests"
    // const conf = model.configuration
    // let schema: ConfigurationSchemaForModel<typeof conf>
    // let options: GetOptions<typeof schema>
    // let base: GetBase<typeof schema>
    // let slot: ConfigurationSlotName<typeof schema>
  })

  test('can nest an array of configuration schemas', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 4.3,
            },
          }),
        ),
      }),
    })

    const model = container.create(undefined, { pluginManager })
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'myArrayOfSubConfigurations')).toBe(undefined)
  })

  test('can nest a single subconfiguration schema', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        mySubConfiguration: ConfigurationSchema('SubObject', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
      }),
    })

    const model = container.create(undefined, { pluginManager })
    expect(isConfigurationModel(model.configuration)).toBe(true)
    expect(getConf(model, 'someInteger')).toBe(12)
    // expect(getConf(model, 'mySubConfiguration.someNumber')).toBe(4.3)
  })

  test('a schema can inherit from another base schema', () => {
    const base = ConfigurationSchema('Foo', {
      someInteger: {
        description: 'an integer slot',
        type: 'integer',
        defaultValue: 12,
      },
      mySubConfiguration: ConfigurationSchema('SubObject', {
        someNumber: {
          description: 'some number in a subconfiguration',
          type: 'number',
          defaultValue: 4.3,
        },
      }),
    })

    const child = ConfigurationSchema(
      'Bar',
      {
        anotherInteger: {
          type: 'integer',
          defaultValue: 4,
        },
      },
      {
        baseConfiguration: base,
      },
    )

    const model = child.create(undefined, { pluginManager })
    expect(isConfigurationModel(model)).toBe(true)
    expect(readConfObject(model, 'someInteger')).toBe(12)

    // type "tests"
    // const conf = model
    // let schema: ConfigurationSchemaForModel<typeof conf>
    // let options: GetOptions<typeof schema>
    // let baseConf: GetBase<typeof schema>
    // let slot: ConfigurationSlotName<typeof schema>
  })

  test('can snapshot a simple schema', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
      }),
    })

    const model = container.create(
      { configuration: { someInteger: 42 } },
      { pluginManager },
    )
    expect(getConf(model, 'someInteger')).toEqual(42)
    expect(getSnapshot(model)).toEqual({ configuration: { someInteger: 42 } })
    expect(getConf(model, 'someInteger')).toEqual(42)

    const model2 = container.create({ configuration: {} }, { pluginManager })
    expect(getSnapshot(model2)).toEqual({ configuration: {} })
    expect(getConf(model2, 'someInteger')).toEqual(12)
  })
  test('can snapshot a nested schema 1', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 3.5,
            },
          }),
        ),
      }),
    })

    const model = container.create(
      {
        configuration: {
          someInteger: 42,
          mySubConfiguration: {},
          myArrayOfSubConfigurations: [
            { someNumber: 3.5 },
            { someNumber: 11.1 },
          ],
        },
      },
      { pluginManager },
    )
    expect(getSnapshot(model)).toEqual({
      configuration: {
        someInteger: 42,
        // mySubConfiguration is set to the default, so doesn't appear in snapshot
        myArrayOfSubConfigurations: [{}, { someNumber: 11.1 }],
      },
    })
  })
  test('can snapshot a nested schema 2', () => {
    const container = types.model({
      configuration: ConfigurationSchema('Foo', {
        someInteger: {
          description: 'an integer slot',
          type: 'integer',
          defaultValue: 12,
        },
        myConfigurationMap: types.map(
          ConfigurationSchema('MappedConfiguration', {
            mappedValue: {
              description: 'something in a mapped configuration',
              type: 'number',
              defaultValue: 101,
            },
          }),
        ),
        mySubConfiguration: ConfigurationSchema('SubObject1', {
          someNumber: {
            description: 'some number in a subconfiguration',
            type: 'number',
            defaultValue: 4.3,
          },
        }),
        myArrayOfSubConfigurations: types.array(
          ConfigurationSchema('SubObject2', {
            someNumber: {
              description: 'some number in a subconfiguration',
              type: 'number',
              defaultValue: 3.5,
            },
          }),
        ),
      }),
    })

    const model = container.create(
      {
        configuration: {
          someInteger: 12,
          myConfigurationMap: { nog: {} },
          mySubConfiguration: { someNumber: 12 },
        },
      },
      { pluginManager },
    )
    expect(getSnapshot(model)).toEqual({
      configuration: {
        myConfigurationMap: { nog: {} },
        mySubConfiguration: { someNumber: 12 },
      },
    })

    expect(getConf(model, ['mySubConfiguration', 'someNumber'])).toEqual(12)
  })

  test('clearing a frozen or stringArray slot to empty preserves the empty value in snapshot', () => {
    // Regression: isEmptyObject/isEmptyArray in postProcessSnapshot was applied
    // to all slot values, so clearing a non-empty default to [] or {} would be
    // silently dropped from the snapshot and revert to the default on next load.
    const container = types.model({
      configuration: ConfigurationSchema('Tester', {
        frozenSlot: {
          type: 'frozen',
          defaultValue: { key: 'original' },
        },
        listSlot: {
          type: 'stringArray',
          defaultValue: ['original'],
        },
      }),
    })

    const model = container.create(undefined, { pluginManager })
    model.configuration.frozenSlot.set({})
    model.configuration.listSlot.set([])

    const snap = getSnapshot(model)
    expect(snap).toEqual({ configuration: { frozenSlot: {}, listSlot: [] } })

    // round-trip: snapshot must restore the empty values, not the original defaults
    const model2 = container.create(snap, { pluginManager })
    expect(getConf(model2, 'frozenSlot')).toEqual({})
    expect(getConf(model2, 'listSlot')).toEqual([])
  })

  test('re-check instantiation of slots (issue #797)', () => {
    const configSchema = ConfigurationSchema(
      'Gff3TabixAdapter',
      {
        gffGzLocation: {
          type: 'fileLocation',
          defaultValue: {
            uri: '/path/to/my.gff.gz',
            locationType: 'UriLocation',
          },
        },
        index: ConfigurationSchema('Gff3TabixIndex', {
          indexType: {
            model: types.enumeration('IndexType', ['TBI', 'CSI']),
            type: 'stringEnum',
            defaultValue: 'TBI',
          },
          location: {
            type: 'fileLocation',
            defaultValue: {
              uri: '/path/to/my.gff.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        }),
        dontRedispatch: {
          type: 'stringArray',
          defaultValue: ['chromosome', 'region'],
        },
        thisShouldGetInstantiated: {
          type: 'string',
          defaultValue: 'Not instantiated',
        },
      },
      { explicitlyTyped: true },
    )
    const tester = configSchema.create(undefined, { pluginManager })
    expect(readConfObject(tester, 'dontRedispatch')[0]).toBe('chromosome')
    expect(readConfObject(tester, 'thisShouldGetInstantiated')).toBe(
      'Not instantiated',
    )
    expect(readConfObject(tester, ['index', 'indexType'])).toBe('TBI')
  })
})

describe('ConfigurationReference', () => {
  // Minimal session shim. isSessionModel needs `rpcManager` + `configuration`;
  // tracksById is what TrackConfigurationReference reads.
  function buildTrackEnv() {
    const TrackConfig = ConfigurationSchema(
      'TestTrack',
      { name: { type: 'string', defaultValue: '' } },
      { explicitIdentifier: 'trackId' },
    )
    const Holder = types.model('Holder', {
      ref: ConfigurationReference(TrackConfig),
    })
    const Session = types
      .model('Session', {
        rpcManager: types.frozen({}),
        configuration: types.frozen({}),
        _tracks: types.array(TrackConfig),
        holder: Holder,
      })
      .views(self => ({
        get tracksById() {
          return Object.fromEntries(self._tracks.map(t => [t.trackId, t]))
        },
      }))
    return { TrackConfig, Holder, Session }
  }

  describe('TrackConfigurationReference', () => {
    test('resolves a known trackId via session.tracksById', () => {
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: 'aaa' },
        },
        { pluginManager },
      )
      expect(readConfObject(session.holder.ref, 'name')).toBe('first')
    })

    test('returns the same instance across reads', () => {
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: 'aaa' },
        },
        { pluginManager },
      )
      expect(session.holder.ref).toBe(session.holder.ref)
    })

    test('throws when the id is not found', () => {
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: 'missing' },
        },
        { pluginManager },
      )
      expect(() => session.holder.ref).toThrow(/missing/)
    })

    test('snapshots as just the trackId string', () => {
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: 'aaa' },
        },
        { pluginManager },
      )
      expect(getSnapshot(session.holder)).toEqual({ ref: 'aaa' })
    })

    test('object input falls through to the schemaType branch', () => {
      // The union dispatcher routes non-string snapshots to schemaType. This
      // is used by test setups that create tracks without a `configuration`
      // field at all — schemaType auto-instantiates a default config. We
      // assert the codepath survives object input here; the object is held
      // as a standalone schema instance (not a reference), and serializes
      // back as the full object snapshot.
      //
      // No production caller passes inline objects anymore; the previous
      // DotplotView -> LinearSyntenyView path (configuration: getSnapshot(...))
      // was updated to pass trackConf.trackId directly.
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: { trackId: 'bbb', name: 'inline' } },
        },
        { pluginManager },
      )
      const snap = getSnapshot(session.holder) as { ref: { trackId: string } }
      expect(snap.ref.trackId).toBe('bbb')
    })
  })

  // Track-state-model shape. isTrackModel needs `configuration.trackId`.
  function buildDisplayEnv() {
    const DisplayConfig = ConfigurationSchema(
      'TestDisplay',
      { foo: { type: 'string', defaultValue: 'x' } },
      { explicitIdentifier: 'displayId', explicitlyTyped: true },
    )
    const TrackConfig = ConfigurationSchema(
      'TestTrack',
      { displays: types.array(DisplayConfig) },
      { explicitIdentifier: 'trackId' },
    )
    const DisplayState = types.model('DisplayState', {
      type: types.string,
      configuration: ConfigurationReference(DisplayConfig),
    })
    const TrackState = types.model('TrackState', {
      configuration: TrackConfig,
      displays: types.array(DisplayState),
    })
    return { DisplayConfig, TrackConfig, DisplayState, TrackState }
  }

  describe('DisplayConfigurationReference', () => {
    test('resolves by displayId', () => {
      const { TrackState } = buildDisplayEnv()
      const track = TrackState.create(
        {
          configuration: {
            trackId: 't1',
            displays: [{ type: 'TestDisplay', displayId: 'd1', foo: 'hello' }],
          },
          displays: [{ type: 'TestDisplay', configuration: 'd1' }],
        },
        { pluginManager },
      )
      expect(readConfObject(track.displays[0].configuration, 'foo')).toBe(
        'hello',
      )
    })

    test('falls back to type-match when displayId is missing', () => {
      const { TrackState } = buildDisplayEnv()
      const track = TrackState.create(
        {
          configuration: {
            trackId: 't1',
            displays: [
              { type: 'TestDisplay', displayId: 'configured', foo: 'matched' },
            ],
          },
          displays: [{ type: 'TestDisplay', configuration: 'someUnknownId' }],
        },
        { pluginManager },
      )
      expect(readConfObject(track.displays[0].configuration, 'foo')).toBe(
        'matched',
      )
    })

    test('auto-creates a default config when neither id nor type matches', () => {
      const { TrackState } = buildDisplayEnv()
      const track = TrackState.create(
        {
          configuration: {
            trackId: 't1',
            displays: [],
          },
          displays: [{ type: 'TestDisplay', configuration: 'newId' }],
        },
        { pluginManager },
      )
      // The auto-created config has the default value; documents the existing
      // "orphaned MST node" behavior — it is detached from track.displays.
      expect(readConfObject(track.displays[0].configuration, 'foo')).toBe('x')
      expect(track.configuration.displays.length).toBe(0)
    })

    test('error when parent has no type to fall back on', () => {
      // Build a custom display state model without a `type` field so the
      // resolver can't auto-create. Verifies the throw path mentions the
      // trackId and that the type lookup also failed.
      const DisplayConfig = ConfigurationSchema(
        'NoTypeDisplay',
        { foo: { type: 'string', defaultValue: 'x' } },
        { explicitIdentifier: 'displayId', explicitlyTyped: true },
      )
      const TrackConfig = ConfigurationSchema(
        'NoTypeTrack',
        { displays: types.array(DisplayConfig) },
        { explicitIdentifier: 'trackId' },
      )
      // DisplayState without a `type` field — parent.type undefined.
      const DisplayState = types.model('NoTypeDisplayState', {
        configuration: ConfigurationReference(DisplayConfig),
      })
      const TrackState = types.model('NoTypeTrackState', {
        configuration: TrackConfig,
        displays: types.array(DisplayState),
      })

      const track = TrackState.create(
        {
          configuration: { trackId: 't9', displays: [] },
          displays: [{ configuration: 'absent' }],
        },
        { pluginManager },
      )
      expect(() => track.displays[0].configuration).toThrow(/t9/)
      expect(() => track.displays[0].configuration).toThrow(/absent/)
    })

    test('writes displayId back into the snapshot', () => {
      // The ref's set() callback should produce the displayId string when
      // the containing state model is serialized.
      const { TrackState } = buildDisplayEnv()
      const track = TrackState.create(
        {
          configuration: {
            trackId: 't1',
            displays: [{ type: 'TestDisplay', displayId: 'd1', foo: 'hello' }],
          },
          displays: [{ type: 'TestDisplay', configuration: 'd1' }],
        },
        { pluginManager },
      )
      expect(getSnapshot(track.displays[0])).toEqual({
        type: 'TestDisplay',
        configuration: 'd1',
      })
    })
  })

  describe('dispatch', () => {
    test('schemas without trackId/displayId use the plain reference branch', () => {
      // No explicitIdentifier → not a track or display ref → plain union.
      // Observable difference: snapshots come out as full objects, not id strings.
      const PlainConfig = ConfigurationSchema('Plain', {
        name: { type: 'string', defaultValue: 'p' },
      })
      const Holder = types.model('PlainHolder', {
        config: ConfigurationReference(PlainConfig),
      })
      const inst = Holder.create({ config: {} }, { pluginManager })
      expect(typeof getSnapshot(inst).config).toBe('object')
    })

    test('track schemas snapshot the ref as the id string', () => {
      // Asserts the dispatch picks TrackConfigurationReference (the only one
      // that wraps with snapshotProcessor → id-string output).
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          _tracks: [{ trackId: 'aaa', name: 'first' }],
          holder: { ref: 'aaa' },
        },
        { pluginManager },
      )
      expect(typeof getSnapshot(session.holder).ref).toBe('string')
    })

    test('display schemas without explicitIdentifier still dispatch as display', () => {
      // The schema name suffix `*DisplayConfigurationSchema` is the fallback
      // signal when displayId isn't declared on the schema itself (most
      // display schemas — displayId is auto-injected by baseTrackConfig
      // preProcessSnapshot). This locks in that the name-suffix dispatch
      // routes correctly without depending on baseTrackConfig.
      const NoIdDisplayConfig = ConfigurationSchema(
        // name → `NoIdDisplayConfigurationSchema`, ends with the suffix
        'NoIdDisplay',
        { foo: { type: 'string', defaultValue: 'x' } },
        { explicitlyTyped: true },
      )
      const TrackConfig = ConfigurationSchema(
        'SuffixTrack',
        { displays: types.array(NoIdDisplayConfig) },
        { explicitIdentifier: 'trackId' },
      )
      const DisplayState = types.model('SuffixDisplayState', {
        type: types.string,
        configuration: ConfigurationReference(NoIdDisplayConfig),
      })
      const TrackState = types.model('SuffixTrackState', {
        configuration: TrackConfig,
        displays: types.array(DisplayState),
      })

      // Type-match fallback inside DisplayConfigurationReference picks this up.
      const track = TrackState.create(
        {
          configuration: {
            trackId: 't1',
            displays: [{ type: 'NoIdDisplay', foo: 'fromConfig' }],
          },
          displays: [{ type: 'NoIdDisplay', configuration: 'autogenId' }],
        },
        { pluginManager },
      )
      expect(readConfObject(track.displays[0].configuration, 'foo')).toBe(
        'fromConfig',
      )
    })
  })
})
