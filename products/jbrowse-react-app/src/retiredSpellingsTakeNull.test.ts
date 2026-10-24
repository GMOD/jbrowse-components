import {
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
} from '@jbrowse/core/configuration'

import createViewState from './createViewState.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('./makeWorkerInstance', () => () => {})

const GROUPS = [
  'display',
  'track',
  'adapter',
  'view',
  'connection',
  'text search adapter',
  'internet account',
  'widget',
] as const

function retiredSpellings(pluginManager: PluginManager) {
  const seen = new Set<unknown>()
  const found: [string, (value: unknown) => unknown][] = []
  function walk(type: unknown) {
    if (seen.has(type) || !isBareConfigurationSchemaType(type)) {
      return
    }
    seen.add(type)
    const meta = getConfigurationSchemaMetadata(type)!
    for (const [key, lift] of Object.entries(meta.options.retired ?? {})) {
      found.push([`${meta.name}.${key}`, lift])
    }
    for (const member of Object.values(meta.definition)) {
      walk(member)
    }
  }
  for (const group of GROUPS) {
    for (const element of pluginManager.getElementTypesInGroup(group)) {
      walk((element as { configSchema?: unknown }).configSchema)
    }
  }
  return found
}

test('every retired spelling lifts a null, as a reset writes one, without a warning', () => {
  const { pluginManager } = createViewState({
    config: { assemblies: [] },
  }) as unknown as { pluginManager: PluginManager }
  const spellings = retiredSpellings(pluginManager)
  expect(spellings.length).toBeGreaterThan(100)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const throwing = spellings.flatMap(([name, lift]) => {
    try {
      lift(null)
      return []
    } catch (e) {
      return [`${name}: ${String(e)}`]
    }
  })
  expect(throwing).toEqual([])
  expect(warn.mock.calls).toEqual([])
  warn.mockRestore()
})
