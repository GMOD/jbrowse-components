import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigBedTextSearchAdapterF(pluginManager: PluginManager) {
  pluginManager.addTextSearchAdapterType(
    () =>
      new TextSearchAdapterType({
        name: 'BigBedTextSearchAdapter',
        displayName: 'BigBed text search adapter',
        description: 'Searches a BigBed by its extra-indexed names',
        configSchema,
        getAdapterClass: () =>
          import('./BigBedTextSearchAdapter.ts').then(r => r.default),
      }),
  )
}
