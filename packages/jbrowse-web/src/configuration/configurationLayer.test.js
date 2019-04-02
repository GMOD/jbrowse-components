import { types, getSnapshot } from 'mobx-state-tree'
import { ConfigurationSchema } from './configurationSchema'
import ConfigurationLayer from './configurationLayer'
import { readConfObject } from '.'

test('can make a layer over a very simple schema', () => {
  const parentSchema = ConfigurationSchema('ParentSchema', {
    foo: {
      type: 'string',
      defaultValue: 'bar',
    },
  })
  const layerSchema = ConfigurationLayer(parentSchema)

  const rootType = types.model({
    parent: parentSchema,
    layer: layerSchema,
  })
  const root = rootType.create({
    parent: { configId: 'yellow' },
    layer: { parentConfigId: 'yellow' },
  })
  const { layer, parent } = root

  expect(readConfObject(layer, 'foo')).toBe('bar')
  expect(readConfObject(parent, 'foo')).toBe('bar')
  parent.foo.set('zonk')
  expect(readConfObject(parent, 'foo')).toBe('zonk')
  expect(readConfObject(layer, 'foo')).toBe('zonk')
  layer.foo.set('zee')
  expect(readConfObject(layer, 'foo')).toBe('zee')
  expect(readConfObject(parent, 'foo')).toBe('zonk')
})

test('can make a layer over a complex nested schema', () => {
  const parentSchema = ConfigurationSchema('ParentSchema', {
    foo: {
      type: 'string',
      defaultValue: 'bar',
    },
    sub1: ConfigurationSchema('SubSchemaOne', {
      sub1attr1: { type: 'string', defaultValue: 'zeek' },
    }),
    arrayOfSubs: types.array(
      ConfigurationSchema('ArrayMemberSchema', {
        arrayMemberAttr1: { type: 'string', defaultValue: 'homer' },
      }),
    ),
    mapOfSubs: types.map(
      ConfigurationSchema('MapMemberSchema', {
        mapMemberAttr1: { type: 'string', defaultValue: 'mickey' },
      }),
    ),
  })
  const layerSchema = ConfigurationLayer(parentSchema)

  const rootType = types.model({
    parent: parentSchema,
    layer: layerSchema,
  })
  const root = rootType.create({
    parent: {
      configId: 'blue',
      arrayOfSubs: [{}],
      mapOfSubs: { one: { configId: 'one' } },
    },
    layer: {
      parentConfigId: 'blue',
      sub1: { parentConfigPath: '../../parent/sub1' },
      arrayOfSubs: [{ parentConfigPath: '../../../parent/arrayOfSubs/0' }],
      mapOfSubs: {
        three: {
          configId: 'three',
          parentConfigPath: '../../../parent/mapOfSubs/one',
        },
      },
    },
  })
  const { layer, parent } = root

  expect(readConfObject(layer, 'foo')).toBe('bar')
  expect(readConfObject(parent, 'foo')).toBe('bar')
  parent.foo.set('zonk')
  expect(readConfObject(parent, 'foo')).toBe('zonk')
  expect(readConfObject(layer, 'foo')).toBe('zonk')
  layer.foo.set('zee')
  expect(readConfObject(layer, 'foo')).toBe('zee')
  expect(readConfObject(parent, 'foo')).toBe('zonk')

  // test simple subschema
  expect(readConfObject(parent, ['sub1', 'sub1attr1'])).toEqual('zeek')
  expect(readConfObject(layer, ['sub1', 'sub1attr1'])).toEqual('zeek')
  parent.sub1.sub1attr1.set('zonk')
  expect(readConfObject(layer, ['sub1', 'sub1attr1'])).toEqual('zonk')
  layer.sub1.sub1attr1.set('zook')
  expect(readConfObject(layer, ['sub1', 'sub1attr1'])).toEqual('zook')
  expect(readConfObject(parent, ['sub1', 'sub1attr1'])).toEqual('zonk')

  // test nested arrays
  expect(
    readConfObject(parent, ['arrayOfSubs', 0, 'arrayMemberAttr1']),
  ).toEqual('homer')
  expect(readConfObject(layer, ['arrayOfSubs', 0, 'arrayMemberAttr1'])).toEqual(
    'homer',
  )
  parent.arrayOfSubs[0].arrayMemberAttr1.set('marge')
  expect(readConfObject(layer, ['arrayOfSubs', 0, 'arrayMemberAttr1'])).toEqual(
    'marge',
  )
  layer.arrayOfSubs[0].arrayMemberAttr1.set('bart')
  expect(readConfObject(layer, ['arrayOfSubs', 0, 'arrayMemberAttr1'])).toEqual(
    'bart',
  )
  expect(
    readConfObject(parent, ['arrayOfSubs', 0, 'arrayMemberAttr1']),
  ).toEqual('marge')

  // test nested maps
  expect(
    readConfObject(parent, ['mapOfSubs', 'one', 'mapMemberAttr1']),
  ).toEqual('mickey')
  expect(
    readConfObject(layer, ['mapOfSubs', 'three', 'mapMemberAttr1']),
  ).toEqual('mickey')
  parent.mapOfSubs.get('one').mapMemberAttr1.set('pluto')
  expect(
    readConfObject(layer, ['mapOfSubs', 'three', 'mapMemberAttr1']),
  ).toEqual('pluto')
  layer.mapOfSubs.get('three').mapMemberAttr1.set('minnie')
  expect(
    readConfObject(layer, ['mapOfSubs', 'three', 'mapMemberAttr1']),
  ).toEqual('minnie')
  expect(
    readConfObject(parent, ['mapOfSubs', 'one', 'mapMemberAttr1']),
  ).toEqual('pluto')

  expect(getSnapshot(root)).toMatchSnapshot({
    parent: {
      arrayOfSubs: [{ configId: expect.any(String) }],
      sub1: { configId: expect.any(String) },
    },
  })
})
