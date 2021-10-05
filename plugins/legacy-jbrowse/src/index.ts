import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TextSearchAdapterType from '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import { configSchema as ncListAdapterConfigSchema } from './NCListAdapter'
import {
  AdapterClass as JBrowse1TextSearchAdapterClass,
  configSchema as jbrowse1AdapterConfigSchema,
} from './JBrowse1TextSeachAdapter'
import { AdapterGuesser, getFileName } from '@jbrowse/core/util/tracks'

import {
  configSchema as jbrowse1ConfigSchema,
  modelFactory as jbrowse1ModelFactory,
} from './JBrowse1Connection'

export default class LegacyJBrowsePlugin extends Plugin {
  name = 'LegacyJBrowsePlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'NCListAdapter',
          configSchema: ncListAdapterConfigSchema,
          getAdapterClass: () =>
            import('./NCListAdapter/NCListAdapter').then(r => r.default),
        }),
    )
    pluginManager.addToExtensionPoint(
      'extendGuessAdapter',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\/trackData.jsonz?$/i
          const adapterName = 'NCListAdapter'
          const fileName = getFileName(file)
          if (regexGuess.test(fileName) || adapterHint === adapterName) {
            return {
              type: adapterName,
              rootUrlTemplate: file,
            }
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )

    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name: 'JBrowse1TextSearchAdapter',
          configSchema: jbrowse1AdapterConfigSchema,
          AdapterClass: JBrowse1TextSearchAdapterClass,
          description: 'A JBrowse 1 text search adapter',
        }),
    )

    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'JBrowse1Connection',
          configSchema: jbrowse1ConfigSchema,
          stateModel: jbrowse1ModelFactory(pluginManager),
          displayName: 'JBrowse 1 Data',
          description: 'A JBrowse 1 data directory',
          url: '//jbrowse.org/',
        }),
    )
  }
}
