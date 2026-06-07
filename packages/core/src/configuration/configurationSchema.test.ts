import { getSnapshot, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

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

    model.configuration.setSlot('backgroundColor', `jexl:'#'+a`)
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('#zonk')
    expect(getConf(model, 'backgroundColor', { a: 'bar' })).toBe('#bar')
    model.configuration.setSlot('backgroundColor', 'hoog')
    expect(getConf(model, 'backgroundColor', { a: 'zonk' })).toBe('hoog')

    model.configuration.setSlot('someInteger', 'jexl:5+a')
    expect(getConf(model, 'someInteger', { a: 5 })).toBe(10)
    model.configuration.setSlot('someInteger', 42)
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

    // an all-default config schema is stripped entirely from the parent
    // snapshot (it reloads to its defaults), so `configuration` is omitted
    const model2 = container.create({ configuration: {} }, { pluginManager })
    expect(getSnapshot(model2)).toEqual({})
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
    model.configuration.setSlot('frozenSlot', {})
    model.configuration.setSlot('listSlot', [])

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

describe('union error scoping', () => {
  // ConfigurationSchema with explicitlyTyped:true produces types.optional(model)
  // members. The MST discriminator must drill through that wrapper so errors are
  // scoped to the one member whose `type` literal matches, not dumped for all.
  test('error is scoped to the matching type member, not all union members', () => {
    if (process.env.NODE_ENV !== 'production') {
      const AlphaConfig = ConfigurationSchema(
        'AlphaTestTrack',
        { count: { type: 'integer', defaultValue: 0 } },
        { explicitlyTyped: true },
      )
      const BetaConfig = ConfigurationSchema(
        'BetaTestTrack',
        { label: { type: 'string', defaultValue: '' } },
        { explicitlyTyped: true },
      )
      const Union = types.union(AlphaConfig, BetaConfig)

      let msg = ''
      try {
        // 'bad' is not a valid slot-object shape for the count field
        Union.create(
          { type: 'AlphaTestTrack', count: 'bad' },
          { pluginManager },
        )
      } catch (e) {
        msg = String(e)
      }

      expect(msg).not.toBe('')
      // Error must be scoped to the AlphaTestTrack member's field
      expect(msg).toContain('/count')
      // Pre-fix: BetaTestTrack's field errors would also appear in the dump
      expect(msg).not.toContain('/label')
    }
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
  })

  describe('TrackConfigurationReference with frozen tracks', () => {
    // Session where tracksById returns plain frozen objects, not MST nodes.
    // This is the real production path: jbrowse.tracks is types.frozen.
    function buildFrozenTrackEnv() {
      const TrackConfig = ConfigurationSchema(
        'TestFrozenTrack',
        { name: { type: 'string', defaultValue: '' } },
        { explicitIdentifier: 'trackId' },
      )
      const Holder = types.model('FrozenHolder', {
        ref: ConfigurationReference(TrackConfig),
      })
      const Session = types
        .model('FrozenSession', {
          rpcManager: types.frozen({}),
          configuration: types.frozen({}),
          _tracks: types.frozen<{ trackId: string; name?: string }[]>([]),
          holder: Holder,
        })
        .views(self => ({
          get tracksById() {
            return Object.fromEntries(self._tracks.map(t => [t.trackId, t]))
          },
        }))
        .actions(self => ({
          setTracks(tracks: { trackId: string; name?: string }[]) {
            self._tracks = tracks
          },
        }))
      return { TrackConfig, Session }
    }

    test('tracksById entry is a plain object before any reference is resolved', () => {
      const { Session } = buildFrozenTrackEnv()
      const session = Session.create(
        { _tracks: [{ trackId: 'f1', name: 'frozen' }], holder: { ref: 'f1' } },
        { pluginManager },
      )
      expect(isStateTreeNode(session.tracksById.f1)).toBe(false)
    })

    test('resolves and hydrates a frozen plain object to an MST node', () => {
      const { Session } = buildFrozenTrackEnv()
      const session = Session.create(
        { _tracks: [{ trackId: 'f1', name: 'frozen' }], holder: { ref: 'f1' } },
        { pluginManager },
      )
      const resolved = session.holder.ref
      expect(isStateTreeNode(resolved)).toBe(true)
      expect(readConfObject(resolved, 'name')).toBe('frozen')
    })

    test('returns the same MST instance across reads for a frozen track', () => {
      const { Session } = buildFrozenTrackEnv()
      const session = Session.create(
        { _tracks: [{ trackId: 'f1', name: 'frozen' }], holder: { ref: 'f1' } },
        { pluginManager },
      )
      expect(session.holder.ref).toBe(session.holder.ref)
    })

    test('produces a new MST instance when the frozen snapshot is replaced', () => {
      const { Session } = buildFrozenTrackEnv()
      const session = Session.create(
        { _tracks: [{ trackId: 'f1', name: 'first' }], holder: { ref: 'f1' } },
        { pluginManager },
      )
      const before = session.holder.ref
      session.setTracks([{ trackId: 'f1', name: 'updated' }])
      const after = session.holder.ref
      expect(after).not.toBe(before)
      expect(readConfObject(after, 'name')).toBe('updated')
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
      expect(readConfObject(track.displays[0]!.configuration, 'foo')).toBe(
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
      expect(readConfObject(track.displays[0]!.configuration, 'foo')).toBe(
        'matched',
      )
    })

    test('throws when neither id nor type matches', () => {
      // Track has no displays entry, and DisplayState's type doesn't match
      // anything either. Used to auto-create a detached config silently; now
      // throws so the missing-display is visible. In production
      // `baseTrackConfig.preProcessSnapshot` always injects a stub display
      // per registered type, so the type-match branch above succeeds first.
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
      expect(() => track.displays[0]!.configuration).toThrow(/newId/)
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
      expect(() => track.displays[0]!.configuration).toThrow(/t9/)
      expect(() => track.displays[0]!.configuration).toThrow(/absent/)
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
      expect(getSnapshot(track.displays[0]!)).toEqual({
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
      // Asserts the dispatch picks TrackConfigurationReference (the trackRef
      // branch serializes via its `set` callback as just the trackId).
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
  })
})
