import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import BgzipTaffyAdapter from './BgzipTaffyAdapter'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BgzipTaffyAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BgzipTaffyAdapter',
        AdapterClass: BgzipTaffyAdapter,
        configSchema,
      }),
  )
}
