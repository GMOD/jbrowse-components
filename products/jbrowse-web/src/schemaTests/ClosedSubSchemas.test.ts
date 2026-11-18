import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'
import {
  asArrayType,
  asMapType,
  getUnionSubtypes,
  isType,
  isUnionType,
  unwrapType,
} from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'

import type { IAnyType } from '@jbrowse/mobx-state-tree'

function walk(type: IAnyType, at: string, seen: Set<IAnyType>, open: string[]) {
  const bare = unwrapType(type)
  const meta = getConfigurationSchemaMetadata(bare)
  const collection = asArrayType(bare) ?? asMapType(bare)
  if (!seen.has(bare)) {
    seen.add(bare)
    if (meta) {
      if (!meta.options.closed) {
        open.push(`${meta.name} at ${at}`)
      }
      for (const [key, entry] of Object.entries(meta.definition)) {
        const member = isSlotDefinitionEntry(entry) ? entry.model : entry
        if (isType(member)) {
          walk(member, `${at}.${key}`, seen, open)
        }
      }
    } else if (isUnionType(bare)) {
      for (const member of getUnionSubtypes(bare)) {
        walk(member, at, seen, open)
      }
    } else if (collection) {
      walk(collection.getChildType(), `${at}[]`, seen, open)
    }
  }
}

test('every schema a registered display holds, at any depth, is closed', () => {
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()
  const seen = new Set<IAnyType>()
  const open: string[] = []
  for (const display of pluginManager.getDisplayElements()) {
    walk(display.configSchema, display.name, seen, open)
  }
  expect(
    [...seen].filter(t => getConfigurationSchemaMetadata(t)).length,
  ).toBeGreaterThan(150)
  expect(open).toEqual([])
})
