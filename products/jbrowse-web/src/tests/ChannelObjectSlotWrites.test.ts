import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
  getConfigurationSchemaUnion,
  isConfigurationSchemaType,
  isSlotDefinitionEntry,
  makeSlotFacade,
  slotChoices,
} from '@jbrowse/core/configuration'
import { asArrayType, getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// The config editor writes a channel object (`facet`, `color`, a mark's
// encoding) one slot at a time, so any combination of slots a user steps
// through has to load again. Every schema declaring a string shorthand is one,
// found by walking the registered displays rather than listed, so a new
// channel object is covered the day it registers.

function subSchemas(type: IAnyType): IAnyType[] {
  const meta = getConfigurationSchemaMetadata(type)
  if (!meta) {
    const members = Object.values(
      getConfigurationSchemaUnion(type)?.members ?? {},
    )
    return [...members, ...members.flatMap(subSchemas)]
  }
  return Object.values(meta.definition).flatMap(entry => {
    if (!isConfigurationSchemaType(entry)) {
      return []
    }
    const inner: IAnyType = asArrayType(entry)?.getChildType() ?? entry
    return [inner, ...subSchemas(inner)]
  })
}

function samples(def: Parameters<typeof slotChoices>[0]): unknown[] {
  const maybe = def.type.startsWith('maybe') ? [undefined] : []
  const choices = slotChoices(def)
  if (choices) {
    return def.type === 'stringEnumArray'
      ? [[], ...choices.map(choice => [choice])]
      : [...maybe, ...choices]
  }
  switch (def.type) {
    case 'stringArray':
      return [[], ['a']]
    case 'colorArray':
      return [[], ['red', 'blue']]
    case 'color':
    case 'maybeColor':
      return [...maybe, 'red']
    case 'string':
    case 'featureField':
      return ['', 'x']
    default:
      return [...maybe, def.defaultValue]
  }
}

const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

const channels = new Map<string, AnyConfigurationSchemaType>()
for (const display of pluginManager.getElementTypesInGroup('display')) {
  const { configSchema } = display as { configSchema?: IAnyType }
  for (const type of configSchema ? subSchemas(configSchema) : []) {
    const meta = getConfigurationSchemaMetadata(type)
    if (meta?.options.shorthand !== undefined) {
      channels.set(meta.name, type as AnyConfigurationSchemaType)
    }
  }
}

test('the walk finds the channel objects', () => {
  expect([...channels.keys()].sort()).toEqual(
    expect.arrayContaining([
      'Facet',
      'FeatureColor',
      'ManhattanColor',
      'MarkColor',
      'MarkShape',
      'RibbonColor',
    ]),
  )
})

test.each([...channels])(
  'every one-slot write to %s reloads as written',
  (_name, schema) => {
    const definition = getConfigurationSchemaMetadata(schema)!.definition
    const slots = Object.entries(definition).flatMap(([slot, def]) =>
      isSlotDefinitionEntry(def) ? [[slot, samples(def)] as const] : [],
    )
    const everySlotSet = Object.fromEntries(
      slots.map(([slot, values]) => [slot, values.at(-1)]),
    )
    for (const start of [{}, everySlotSet]) {
      for (const [slot, values] of slots) {
        for (const value of values) {
          const node = schema.create(start)
          makeSlotFacade(node, slot).set(value)
          const written = getSnapshot(node)
          expect(getSnapshot(schema.create(written))).toEqual(written)
        }
      }
    }
  },
)
