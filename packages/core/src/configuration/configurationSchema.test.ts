import {
  getSnapshot,
  getType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
import { getConf, readConfObject } from './index.ts'
import { isConfigurationModel } from './schemaTypes.ts'
import { getSlotDefinition } from './slotFacade.ts'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from './types.ts'

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

  // Everything else in the options merge is a shallow `{...base, ...child}`
  // spread. These four hooks compose instead, because `createBaseTrackConfig`
  // declares two of them and replace-semantics meant no track config schema
  // could declare its own at all.
  describe('baseConfiguration hook composition', () => {
    const numberSlot = { x: { type: 'number', defaultValue: 1 } } as const

    test('actions chain, and the child sees the base actions on self', () => {
      const base = ConfigurationSchema('ActionBase', numberSlot, {
        actions: () => ({ baseAction: () => 'base' }),
      })
      const child = ConfigurationSchema(
        'ActionChild',
        {},
        {
          baseConfiguration: base,
          actions: (self: unknown) => ({
            childAction: () =>
              `${(self as { baseAction: () => string }).baseAction()}+child`,
          }),
        },
      )
      const node = child.create(undefined, { pluginManager }) as unknown as {
        baseAction: () => string
        childAction: () => string
      }
      expect(node.baseAction()).toBe('base')
      // proof the two are separate MST `.actions()` calls rather than one merged
      // object: a merged object would not have baseAction on self here
      expect(node.childAction()).toBe('base+child')
    })

    test('a child action of the same name overrides the base one', () => {
      const base = ConfigurationSchema('OverrideBase', numberSlot, {
        actions: () => ({ which: () => 'base' }),
      })
      const child = ConfigurationSchema(
        'OverrideChild',
        {},
        {
          baseConfiguration: base,
          actions: () => ({ which: () => 'child' }),
        },
      )
      const node = child.create(undefined, { pluginManager }) as unknown as {
        which: () => string
      }
      expect(node.which()).toBe('child')
    })

    test('views chain across three levels', () => {
      const base = ConfigurationSchema('ViewBase', numberSlot, {
        views: () => ({ baseView: () => 'base' }),
      })
      const middle = ConfigurationSchema(
        'ViewMiddle',
        {},
        { baseConfiguration: base, views: () => ({ midView: () => 'mid' }) },
      )
      const leaf = ConfigurationSchema(
        'ViewLeaf',
        {},
        {
          baseConfiguration: middle,
          views: () => ({ leafView: () => 'leaf' }),
        },
      )
      const node = leaf.create(undefined, { pluginManager }) as unknown as {
        baseView: () => string
        midView: () => string
        leafView: () => string
      }
      expect([node.baseView(), node.midView(), node.leafView()]).toEqual([
        'base',
        'mid',
        'leaf',
      ])
    })

    test('extend chains rather than clobbering the other members', () => {
      const base = ConfigurationSchema('ExtendBase', numberSlot, {
        extend: () => ({ views: { baseView: () => 'base' } }),
      })
      const child = ConfigurationSchema(
        'ExtendChild',
        {},
        {
          baseConfiguration: base,
          // declares only `actions` where the base declared only `views`. A
          // spread merge of the two return values would drop one of them
          extend: () => ({ actions: { childAction: () => 'child' } }),
        },
      )
      const node = child.create(undefined, { pluginManager }) as unknown as {
        baseView: () => string
        childAction: () => string
      }
      expect(node.baseView()).toBe('base')
      expect(node.childAction()).toBe('child')
    })

    test('preProcessSnapshot composes base first, then child', () => {
      const base = ConfigurationSchema('PreProcessBase', numberSlot, {
        preProcessSnapshot: snap => ({ ...snap, x: Number(snap.x) + 1 }),
      })
      const child = ConfigurationSchema(
        'PreProcessChild',
        {},
        {
          baseConfiguration: base,
          preProcessSnapshot: snap => ({ ...snap, x: Number(snap.x) * 10 }),
        },
      )
      // base normalizes (0 -> 1), then the child refines (1 -> 10). The other
      // order gives 1, so this pins the direction, not just that both ran
      const node = child.create({ x: 0 }, { pluginManager })
      expect(readConfObject(node, 'x')).toBe(10)
    })

    test('a lone hook is left exactly as the caller passed it', () => {
      const base = ConfigurationSchema(
        'DistinctHookBase',
        { x: { type: 'number', defaultValue: 1 } },
        { actions: () => ({ baseAction: () => 'base' }) },
      )
      const child = ConfigurationSchema(
        'DistinctHookChild',
        {},
        {
          baseConfiguration: base,
          views: () => ({ childView: () => 'child' }),
        },
      )
      const node = child.create(undefined, { pluginManager }) as unknown as {
        baseAction: () => string
        childView: () => string
      }
      // both the base's action and the child's view are present — proof the
      // merge composes across different hook keys, only same-key overlap throws
      expect(node.baseAction()).toBe('base')
      expect(node.childView()).toBe('child')
    })
  })

  // Only the type ConfigurationSchema() itself returns carries a slot table, and
  // a base without one used to be skipped in silence — leaving a schema missing
  // every inherited slot, with nothing thrown at any layer. Both wrappers below
  // pass `isBareConfigurationSchemaType`, so neither looks wrong at the call
  // site; `pluggableConfigSchemaType` returns the union form.
  describe('baseConfiguration that carries no slot table', () => {
    const base = ConfigurationSchema('RealBase', {
      inherited: { type: 'number', defaultValue: 7 },
    })

    test.each([
      ['a types.late wrapper', () => types.late(() => base)],
      ['a union of schemas', () => types.union(base, base)],
      ['a plain MST model', () => types.model('NotASchema', {})],
    ])('throws for %s', (_label, makeBase) => {
      expect(() =>
        ConfigurationSchema(
          'NoTable',
          { own: { type: 'number', defaultValue: 1 } },
          // the point is that these are accepted at compile time
          { baseConfiguration: makeBase() as AnyConfigurationSchemaType },
        ),
      ).toThrow(/NoTable's baseConfiguration is not a configuration schema/)
    })

    test('the real schema still merges its slots in', () => {
      const child = ConfigurationSchema(
        'HasTable',
        { own: { type: 'number', defaultValue: 1 } },
        { baseConfiguration: base },
      )
      const node = child.create(undefined, { pluginManager })
      expect(readConfObject(node, 'inherited')).toBe(7)
    })
  })

  describe('baseConfiguration slot override merge', () => {
    // The definition merge in preprocessConfigurationSchemaArguments is
    // field-by-field for a redeclared *slot* and wholesale for everything else,
    // so an override states only what differs. Replace semantics were the old
    // behavior and dropped every field an override left out, silently.
    const isEven = (value: unknown) =>
      typeof value === 'number' && value % 2 === 0
    const base = ConfigurationSchema('MergeBase', {
      size: {
        type: 'number',
        defaultValue: 2,
        description: 'the base description',
        contextVariable: ['feature'],
        validate: isEven,
        advanced: true,
      },
      mySubConfiguration: ConfigurationSchema('MergeBaseSub', {
        kept: { type: 'number', defaultValue: 1 },
        dropped: { type: 'number', defaultValue: 2 },
      }),
      label: 'base label',
    })

    test('an override keeps what it states and inherits the rest', () => {
      const child = ConfigurationSchema(
        'MergeChild',
        { size: { type: 'number', defaultValue: 4 } },
        { baseConfiguration: base },
      )
      const def = getSlotDefinition(
        child.create(undefined, { pluginManager }),
        'size',
      )
      expect(def.defaultValue).toBe(4)
      expect(def.description).toBe('the base description')
      expect(def.contextVariable).toEqual(['feature'])
      expect(def.validate).toBe(isEven)
      expect(def.advanced).toBe(true)
    })

    test('stating a field turns an inherited one off', () => {
      const child = ConfigurationSchema(
        'MergeOptOut',
        { size: { type: 'number', defaultValue: 4, advanced: false } },
        { baseConfiguration: base },
      )
      expect(
        getSlotDefinition(child.create(undefined, { pluginManager }), 'size')
          .advanced,
      ).toBe(false)
    })

    // a sub-schema is an opaque entry with no fields to fold, so it replaces
    test('a redeclared sub-schema replaces the base one wholesale', () => {
      const child = ConfigurationSchema(
        'MergeSubChild',
        {
          mySubConfiguration: ConfigurationSchema('MergeChildSub', {
            kept: { type: 'number', defaultValue: 10 },
          }),
        },
        { baseConfiguration: base },
      )
      const node = child.create(undefined, { pluginManager })
      expect(readConfObject(node, ['mySubConfiguration', 'kept'])).toBe(10)
      expect(
        readConfObject(node, ['mySubConfiguration', 'dropped']),
      ).toBeUndefined()
    })

    test('a redeclared constant replaces the base one wholesale', () => {
      const child = ConfigurationSchema(
        'MergeConstChild',
        { label: 'child label' },
        { baseConfiguration: base },
      )
      const node = child.create(undefined, { pluginManager })
      expect((node as unknown as { label: string }).label).toBe('child label')
    })
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

describe('setSubschema', () => {
  test('replaces a direct sub-schema slot', () => {
    const schema = ConfigurationSchema('WithSub', {
      sub: ConfigurationSchema('Sub', {
        x: { type: 'number', defaultValue: 1 },
      }),
    })
    const node = schema.create(undefined, { pluginManager })
    node.setSubschema('sub', { x: 5 })
    expect(readConfObject(node, ['sub', 'x'])).toBe(5)
  })

  test('throws a friendly error for a non-subschema slot', () => {
    const schema = ConfigurationSchema('WithScalar', {
      count: { type: 'integer', defaultValue: 1 },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => node.setSubschema('count', {})).toThrow(
      /count is not a subschema, cannot replace/,
    )
  })

  test('throws the same friendly error for a collection (array) of sub-schemas, not an MST validation error', () => {
    // isConfigurationSchemaType recognizes an array-of-schema slot as a schema
    // type too, but setSubschema's `.create(data)` call assumes a single
    // sub-schema snapshot. Without excluding collections from the membership
    // check, this throws a confusing "not assignable" MST error instead.
    const schema = ConfigurationSchema('WithCollection', {
      items: types.array(
        ConfigurationSchema('Item', {
          x: { type: 'number', defaultValue: 1 },
        }),
      ),
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => node.setSubschema('items', { x: 2 })).toThrow(
      /items is not a subschema, cannot replace/,
    )
  })

  test('throws the same friendly error for a collection (map) of sub-schemas', () => {
    const schema = ConfigurationSchema('WithMapCollection', {
      items: types.map(
        ConfigurationSchema('MapItem', {
          x: { type: 'number', defaultValue: 1 },
        }),
      ),
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => node.setSubschema('items', { x: 2 })).toThrow(
      /items is not a subschema, cannot replace/,
    )
  })
})

describe('setSlot', () => {
  // A misspelled slot name used to be completely silent: the assignment landed
  // on an undeclared property, so nothing threw, nothing persisted, and the
  // matching read went on returning the default. The compile-time guard on
  // `setConf` only covers writes whose schema is concrete, and a mixin or a
  // widened factory erases that, so this runtime check is what covers the rest.
  test('throws for a slot the schema does not declare', () => {
    const schema = ConfigurationSchema('WithScalar', {
      count: { type: 'integer', defaultValue: 1 },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => {
      node.setSlot('cuont', 2)
    }).toThrow(/WithScalar has no config slot "cuont"/)
    expect(readConfObject(node, 'count')).toBe(1)
  })

  test('the error names the valid slots', () => {
    const schema = ConfigurationSchema('Named', {
      alpha: { type: 'integer', defaultValue: 1 },
      beta: { type: 'integer', defaultValue: 2 },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => {
      node.setSlot('gamma', 3)
    }).toThrow(/Valid slots: alpha, beta/)
  })

  test('a slot inherited from baseConfiguration is accepted', () => {
    // mergeSchemaDefinition folds the base's slots into the derived schema's
    // modelDefinition, so the membership check sees them. If it ever stopped
    // doing that, every inherited-slot write in the repo would start throwing.
    const base = ConfigurationSchema('Base', {
      inherited: { type: 'integer', defaultValue: 1 },
    })
    const derived = ConfigurationSchema(
      'Derived',
      { own: { type: 'integer', defaultValue: 2 } },
      { baseConfiguration: base },
    )
    const node = derived.create(undefined, { pluginManager })
    node.setSlot('inherited', 10)
    node.setSlot('own', 20)
    expect(readConfObject(node, 'inherited')).toBe(10)
    expect(readConfObject(node, 'own')).toBe(20)
  })

  test('an Object.prototype member is not mistaken for a slot', () => {
    // the slot names are a Set, so `toString` is a miss structurally. It was a
    // plain object once, where the answer turned on picking Object.hasOwn over
    // `in` — `'toString' in modelDefinition` is true.
    const schema = ConfigurationSchema('Proto', {
      count: { type: 'integer', defaultValue: 1 },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(() => {
      node.setSlot('toString', 2)
    }).toThrow(/Proto has no config slot "toString"/)
  })

  // The check is against the slots, not against every model property. These two
  // are properties, so they used to pass it: the sub-schema write then landed
  // outright — doing setSubschema's job without its array/map guard — and the
  // identifier write fell through to an MST error about identifiers, from a
  // call whose whole purpose is to name the mistake.
  describe('a property that is not a slot', () => {
    const schema = ConfigurationSchema(
      'NotSlots',
      {
        real: { type: 'integer', defaultValue: 1 },
        sub: ConfigurationSchema('NotSlotsSub', {
          x: { type: 'number', defaultValue: 1 },
        }),
        items: types.array(
          ConfigurationSchema('NotSlotsItem', {
            x: { type: 'number', defaultValue: 1 },
          }),
        ),
      },
      { explicitIdentifier: 'notSlotsId' },
    )
    const make = () => schema.create({ notSlotsId: 'one' }, { pluginManager })

    test.each(['sub', 'items'])('%s points at setSubschema', key => {
      expect(() => {
        make().setSlot(key, { x: 2 })
      }).toThrow(new RegExp(`${key} is a sub-schema on NotSlots.*setSubschema`))
    })

    test('the identifier is rejected here, not by MST', () => {
      expect(() => {
        make().setSlot('notSlotsId', 'two')
      }).toThrow(/NotSlots has no config slot "notSlotsId"/)
    })

    test('the valid-slot list names only slots', () => {
      expect(() => {
        make().setSlot('nope', 1)
      }).toThrow(/Valid slots: real$/)
    })
  })
})

describe('schema definition entry classification', () => {
  test('a slot definition missing its type throws a specific error', () => {
    expect(() =>
      // @ts-expect-error a slot definition without `type` is also a compile
      // error; this pins the runtime throw a JS plugin still reaches
      ConfigurationSchema('Bad', { broken: { defaultValue: 1 } }),
    ).toThrow(/no type set for config slot Bad.broken/)
  })

  test('a non-slot, non-constant, non-schema entry throws', () => {
    expect(() =>
      // @ts-expect-error a bare boolean is not a valid definition entry
      ConfigurationSchema('Bad', { broken: true }),
    ).toThrow(/invalid configuration schema definition/)
  })

  test('string/number entries become read-only volatile constants', () => {
    const schema = ConfigurationSchema('WithConstants', {
      label: 'hello',
      count: 42,
      real: { type: 'string', defaultValue: 'x' },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(node.label).toBe('hello')
    expect(node.count).toBe(42)
    // constants are not part of the persisted snapshot
    expect(getSnapshot(node)).toEqual({})
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
  // getTrackById is what TrackConfigurationReference reads.
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
        getTrackById(id: string) {
          return self._tracks.find(t => t.trackId === id)
        },
      }))
    return { TrackConfig, Holder, Session }
  }

  describe('TrackConfigurationReference', () => {
    test('resolves a known trackId via session.getTrackById', () => {
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

    // Fast unit canary for the inline-config union branch documented in
    // configuration/CLAUDE.md — otherwise only covered by the slow
    // SVInspector.test.tsx and ReadVsRef.test.tsx integration tests. It is the
    // one way a view holds a track config nothing else can draw, and an id
    // string that no session list holds resolves nowhere: the test above this
    // one is what says so.
    test('accepts a full inline config snapshot held as an owned instance, not a ref', () => {
      const { Session } = buildTrackEnv()
      const session = Session.create(
        {
          holder: { ref: { trackId: 'inline1', name: 'inline-name' } },
        },
        { pluginManager },
      )
      expect(session.getTrackById('inline1')).toBeUndefined()
      expect(readConfObject(session.holder.ref, 'name')).toBe('inline-name')
      expect(getSnapshot(session.holder)).toEqual({
        ref: { trackId: 'inline1', name: 'inline-name' },
      })
    })
  })

  describe('TrackConfigurationReference with frozen tracks', () => {
    // Session where getTrackById returns plain frozen objects, not MST nodes.
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
          getTrackById(id: string) {
            return self._tracks.find(t => t.trackId === id)
          },
        }))
        .actions(self => ({
          setTracks(tracks: { trackId: string; name?: string }[]) {
            self._tracks = tracks
          },
        }))
      return { TrackConfig, Session }
    }

    test('getTrackById entry is a plain object before any reference is resolved', () => {
      const { Session } = buildFrozenTrackEnv()
      const session = Session.create(
        { _tracks: [{ trackId: 'f1', name: 'frozen' }], holder: { ref: 'f1' } },
        { pluginManager },
      )
      expect(isStateTreeNode(session.getTrackById('f1'))).toBe(false)
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

    test('the same frozen object hydrates independently per schemaType (no cross-instance collision)', () => {
      // Regression: the hydration cache used to be a bare module-level WeakMap
      // keyed by the frozen object alone. Two schemas built by two separate
      // buildFrozenTrackEnv() calls sharing one frozen track object used to
      // collide on that shared identity.
      const { Session: SessionA } = buildFrozenTrackEnv()
      const { Session: SessionB } = buildFrozenTrackEnv()

      const sharedFrozenTrack = { trackId: 'shared', name: 'orig' }

      const sessionA = SessionA.create(
        { _tracks: [sharedFrozenTrack], holder: { ref: 'shared' } },
        { pluginManager },
      )
      const sessionB = SessionB.create(
        { _tracks: [sharedFrozenTrack], holder: { ref: 'shared' } },
        { pluginManager },
      )

      const resolvedA = sessionA.holder.ref
      const resolvedB = sessionB.holder.ref

      // Pre-fix, sessionB's lookup would hit the cache entry sessionA's access
      // just created (keyed on the frozen object alone) and hand back sessionA's
      // node verbatim, even though buildFrozenTrackEnv gave each session its
      // own distinct schemaType.
      expect(resolvedA).not.toBe(resolvedB)
      expect(getType(resolvedA)).not.toBe(getType(resolvedB))
    })

    test('two independent PluginManager instances never share a hydration cache entry', () => {
      // The realistic version of the collision above: two independent
      // PluginManager instances (e.g. two createViewState() calls on one page)
      // that happen to be handed the identical frozen track object — the
      // schemaType each one builds for "TestFrozenTrack" differs even though
      // the model name is the same string, but the cache lives on
      // pluginManager.trackConfigHydrationCache, so isolation holds
      // structurally rather than depending on that.
      const pluginManagerA = new PluginManager([]).createPluggableElements()
      pluginManagerA.configure()
      const pluginManagerB = new PluginManager([]).createPluggableElements()
      pluginManagerB.configure()

      const { Session } = buildFrozenTrackEnv()
      const sharedFrozenTrack = { trackId: 'shared', name: 'orig' }

      const sessionA = Session.create(
        { _tracks: [sharedFrozenTrack], holder: { ref: 'shared' } },
        { pluginManager: pluginManagerA },
      )
      const sessionB = Session.create(
        { _tracks: [sharedFrozenTrack], holder: { ref: 'shared' } },
        { pluginManager: pluginManagerB },
      )

      const resolvedA = sessionA.holder.ref
      const resolvedB = sessionB.holder.ref

      expect(resolvedA).not.toBe(resolvedB)
      expect(pluginManagerA.trackConfigHydrationCache).not.toBe(
        pluginManagerB.trackConfigHydrationCache,
      )
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

    // The plain branch is `types.union(ref, schema)` with no dispatcher, and
    // that is load-bearing rather than an oversight the other two branches
    // already corrected. `initializeInternetAccount` pushes
    // `jbrowse.internetAccounts[i]` — a node that already has a parent —
    // straight into `configuration`, and an undispatched union routes it to the
    // reference member because `BaseReferenceType.isAssignableFrom` defers to
    // its target type. Giving this branch `idOrSnapshotUnion`'s
    // `typeof snapshot === 'string'` dispatcher routes it to the schema member
    // instead, and MST refuses to adopt a parented node ("Cannot add an object
    // to a state tree if it is already part of ... another state tree").
    test('a plain ref takes a live in-tree config node as a reference', () => {
      const AccountConfig = ConfigurationSchema(
        'TestAccount',
        { name: { type: 'string', defaultValue: '' } },
        { explicitIdentifier: 'accountId' },
      )
      const Account = types.model('Account', {
        configuration: ConfigurationReference(AccountConfig),
      })
      const Root = types
        .model('AccountRoot', {
          configs: types.array(AccountConfig),
          accounts: types.array(Account),
        })
        .actions(self => ({
          open(config: AnyConfigurationModel) {
            self.accounts.push({ configuration: config })
          },
        }))
      const root = Root.create(
        { configs: [{ accountId: 'a1', name: 'first' }] },
        { pluginManager },
      )
      root.open(root.configs[0]!)

      expect(root.accounts[0]!.configuration).toBe(root.configs[0])
      expect(getSnapshot(root.accounts[0]!)).toEqual({ configuration: 'a1' })
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

describe('readConfObject path resolution', () => {
  test('no path returns the whole config snapshot (defaults stripped)', () => {
    const schema = ConfigurationSchema('Whole', {
      a: { type: 'number', defaultValue: 1 },
      b: { type: 'string', defaultValue: 'x' },
    })
    const node = schema.create({ b: 'y' }, { pluginManager })
    expect(readConfObject(node)).toEqual({ b: 'y' })
  })

  // An empty array is a path naming no slot, so it means what no path means.
  // It used to answer `undefined`: `[]` is truthy, so it took the array branch,
  // whose `slotPath[0]!` was a lie and read `confObject[undefined]`.
  test('an empty array path reads the whole config, same as no path', () => {
    const schema = ConfigurationSchema('WholeEmptyPath', {
      a: { type: 'number', defaultValue: 1 },
      b: { type: 'string', defaultValue: 'x' },
    })
    const node = schema.create({ b: 'y' }, { pluginManager })
    expect(readConfObject(node, [])).toEqual(readConfObject(node))
  })

  test('a nested array path evaluates a jexl callback with args', () => {
    const schema = ConfigurationSchema('Outer', {
      labels: ConfigurationSchema('Labels', {
        name: {
          type: 'string',
          defaultValue: "jexl:get(feature,'n')",
          contextVariable: ['feature'],
        },
      }),
    })
    const node = schema.create(undefined, { pluginManager })
    const out = readConfObject(node, ['labels', 'name'], {
      feature: { get: (k: string) => (k === 'n' ? 'HELLO' : undefined) },
    })
    expect(out).toBe('HELLO')
  })

  test('a missing sub-config in an array path yields undefined, not a throw', () => {
    const schema = ConfigurationSchema('Outer', {
      a: { type: 'number', defaultValue: 1 },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(readConfObject(node, ['missing', 'deeper'])).toBeUndefined()
  })

  // A top-level config can itself be a types.map (e.g. an assembly's per-key
  // configs). rawSlotValue falls back from property access to map.get() so the
  // same readConfObject API drills into map entries. Easy to break unknowingly.
  describe('top-level types.map config (rawSlotValue map fallback)', () => {
    const MapConfig = types.map(
      ConfigurationSchema('Item', { val: { type: 'number', defaultValue: 1 } }),
    )
    const make = () =>
      MapConfig.create({ a: { val: 5 }, b: { val: 1 } }, { pluginManager })

    test('reading a key returns that entry as a snapshot', () => {
      expect(readConfObject(make(), 'a')).toEqual({ val: 5 })
    })

    test('an all-default entry snapshots as an empty object', () => {
      expect(readConfObject(make(), 'b')).toEqual({})
    })

    test('a missing key returns undefined', () => {
      expect(readConfObject(make(), 'zzz')).toBeUndefined()
    })

    test('an array path drills into a map entry slot', () => {
      expect(readConfObject(make(), ['a', 'val'])).toBe(5)
    })
  })

  // The two spellings of one nested read disagree: a sub-config slot read hands
  // back a stripDefault'd snapshot, so reading a defaulted slot off *that*
  // answers undefined ("no limit declared") instead of the default. A real bug —
  // the byte gate read a BAM's 5Mb fetchSizeLimit that way and used the display's
  // 1Mb (810c7fb8fd). The wrong spelling is now a compile error
  // (configTypeNarrowing.test.ts); this pins the runtime asymmetry it guards, so
  // the reason the type is load-bearing stays visible.
  describe('a slot read off a sub-config snapshot', () => {
    const schema = ConfigurationSchema('Track', {
      sub: ConfigurationSchema('Sub', {
        limit: { type: 'number', defaultValue: 5_000_000 },
      }),
    })
    const make = () => schema.create(undefined, { pluginManager })

    test('reads undefined for a defaulted slot: why the type forbids it', () => {
      const snap = readConfObject(make(), 'sub')
      expect(snap).toEqual({})
      // @ts-expect-error -- a snapshot is not a readable config
      expect(readConfObject(snap, 'limit')).toBeUndefined()
    })

    test('the array path off the live node resolves the default', () => {
      expect(readConfObject(make(), ['sub', 'limit'])).toBe(5_000_000)
    })
  })

  // A plain config object is read directly, with no snapshot-shaped guard in the
  // way. Two live callers depend on it and neither can hydrate: `generateHierarchy`
  // reads slots off the un-hydrated frozen entries of `jbrowse.tracks` (hydrating
  // 10k tracks to fill the track selector is what types.frozen exists to avoid),
  // and `getSharedTracks` (breakpoint-split-view) is tested with a fixture track
  // that has no assemblyNames on purpose. That is why the stripped-snapshot rule
  // is enforced in the types and NOT at runtime — a runtime check cannot tell
  // these apart from the broken spelling.
  test('a plain config object reads undefined for an absent slot', () => {
    const plain = { trackId: 'a' } as unknown as AnyConfigurationModel
    expect(readConfObject(plain, 'assemblyNames')).toBeUndefined()
    expect(readConfObject(plain, 'trackId')).toBe('a')
  })

  test('drilling into a frozen slot tolerates a missing key', () => {
    const schema = ConfigurationSchema('Frozen', {
      blob: { type: 'frozen', defaultValue: { present: 1 } },
    })
    const node = schema.create(undefined, { pluginManager })
    expect(readConfObject(node, ['blob', 'present'])).toBe(1)
    expect(readConfObject(node, ['blob', 'absent'])).toBeUndefined()
  })
})
