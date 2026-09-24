import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from '@jbrowse/core/configuration'

import corePlugins from '../corePlugins.ts'

// `jexlFilters` sat on `baseLinearDisplayConfigSchema`, so eleven display
// schemas published it and three models read it. On the other eight a track
// config declaring filters passed `jbrowse validate`, loaded, and filtered
// nothing. The slot is `jexlFilterConfigSchemaFields` now, spread only by the
// schemas whose displays read it through `configuredJexlFilters`.
//
// Here for the reason `ConfigSlotDefaults.test.ts` next door is: jbrowse-web is
// the only place the whole plugin set is assembled. A display added to the list
// owes a `configuredFilters()` that reads the slot; one removed from it owes the
// spread going away.
const pluginManager = new PluginManager(
  corePlugins.map(P => new P()),
).createPluggableElements()

test('only the displays that read jexlFilters publish it', () => {
  const publishing: string[] = []
  for (const element of pluginManager.getElementTypesInGroup('display')) {
    const { name, configSchema } = element as {
      name: string
      configSchema?: unknown
    }
    const definition = configSchema
      ? getConfigurationSchemaDefinition(
          configSchema as Parameters<
            typeof getConfigurationSchemaDefinition
          >[0],
        )
      : undefined
    const entry = definition?.jexlFilters
    if (entry && isSlotDefinitionEntry(entry)) {
      publishing.push(name)
    }
  }
  expect(publishing.sort()).toEqual([
    'LinearBasicDisplay',
    'LinearMarkDisplay',
    'LinearMultiSampleVariantDisplay',
    'LinearVariantDisplay',
  ])
})
