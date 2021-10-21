import Plugin from '@jbrowse/core/Plugin'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { version } from '../package.json'
import {
  BigsiHitsAdapterClass,
  BigsiHitsSchema,
  MashmapHitsConfigAdapterClass,
  MashmapHitsConfigSchema,
  MashmapOutputAdapterClass,
  MashmapOutputSchema,
} from './FlashmapAdapter'

import { BigsiQueryRPC } from './BigsiRPC/rpcMethods'

export default class Flashmap extends Plugin {
  name = 'Flashmap'
  version = version

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'BigsiHitsAdapter',
          configSchema: BigsiHitsSchema,
          AdapterClass: BigsiHitsAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MashmapHitsConfigAdapter',
          configSchema: MashmapHitsConfigSchema,
          AdapterClass: MashmapHitsConfigAdapterClass,
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MashmapOutputAdapterClass',
          configSchema: MashmapOutputSchema,
          AdapterClass: MashmapOutputAdapterClass,
        }),
    )

    pluginManager.addRpcMethod(() => new BigsiQueryRPC(pluginManager))
  }
}
