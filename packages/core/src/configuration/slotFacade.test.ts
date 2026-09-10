import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from './configurationSchema.ts'
import { makeSlotFacade, preProcessSlotValues } from './slotFacade.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const create = (schema: ReturnType<typeof ConfigurationSchema>) =>
  schema.create(undefined, { pluginManager })

test('facade exposes metadata + a live value getter driven by set()', () => {
  const schema = ConfigurationSchema('Test', {
    color: {
      type: 'color',
      defaultValue: 'red',
      description: 'the color',
      contextVariable: ['feature'],
    },
  })
  const node = create(schema)
  const facade = makeSlotFacade(node, 'color')

  expect(facade.name).toBe('color')
  expect(facade.type).toBe('color')
  expect(facade.description).toBe('the color')
  expect(facade.defaultValue).toBe('red')
  expect(facade.contextVariable).toEqual(['feature'])
  expect(facade.pluginManager).toBe(pluginManager)
  expect(facade.value).toBe('red')

  facade.set('green')
  expect(facade.value).toBe('green')
  expect(node.color).toBe('green')
})

test('facade derives stringEnum choices from the metadata model', () => {
  const schema = ConfigurationSchema('Test', {
    mode: {
      type: 'stringEnum',
      model: types.enumeration('Mode', ['a', 'b', 'c']),
      defaultValue: 'a',
    },
  })
  const facade = makeSlotFacade(create(schema), 'mode')
  expect(facade.choices).toEqual(['a', 'b', 'c'])
})

test('facade finds slots inherited via baseConfiguration', () => {
  const base = ConfigurationSchema('Base', {
    shared: { type: 'string', defaultValue: 'inherited' },
  })
  const schema = ConfigurationSchema(
    'Child',
    { own: { type: 'number', defaultValue: 1 } },
    { baseConfiguration: base },
  )
  const node = create(schema)
  expect(makeSlotFacade(node, 'shared').value).toBe('inherited')
  expect(makeSlotFacade(node, 'own').value).toBe(1)
})

test('facade set replaces an array slot value wholesale', () => {
  const schema = ConfigurationSchema('Test', {
    list: { type: 'stringArray', defaultValue: ['a', 'b'] },
  })
  const node = create(schema)
  const facade = makeSlotFacade(node, 'list')

  expect([...(facade.value as string[])]).toEqual(['a', 'b'])
  facade.set(['z', 'c'])
  expect([...node.list]).toEqual(['z', 'c'])
})

test('preProcessSlotValues runs the schema hook over a partial slot bag', () => {
  const schema = ConfigurationSchema(
    'Preprocessed',
    {
      color: { type: 'color', defaultValue: 'red' },
      useBicolor: { type: 'boolean', defaultValue: true },
    },
    {
      preProcessSnapshot: (snap: Record<string, unknown>) =>
        snap.color !== undefined && snap.useBicolor === undefined
          ? { ...snap, useBicolor: false }
          : snap,
    },
  )
  const node = create(schema)

  expect(preProcessSlotValues(node, { color: 'green' })).toEqual({
    color: 'green',
    useBicolor: false,
  })
  expect(
    preProcessSlotValues(node, { color: 'green', useBicolor: true }),
  ).toEqual({ color: 'green', useBicolor: true })
})

test('preProcessSlotValues passes values through a schema with no hook', () => {
  const schema = ConfigurationSchema('Plain', {
    height: { type: 'number', defaultValue: 100 },
  })
  const values = { height: 250 }
  expect(preProcessSlotValues(create(schema), values)).toBe(values)
})
