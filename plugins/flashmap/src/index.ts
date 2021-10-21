import Plugin from '@jbrowse/core/Plugin'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  BigsiHitsAdapterClass,
  BigsiHitsSchema,
  MashmapHitsConfigAdapterClass,
  MashmapHitsConfigSchema,
  MashmapOutputAdapterClass,
  MashmapOutputSchema,
} from './FlashmapAdapter'

import { BigsiQueryRPC } from './BigsiRPC/rpcMethods'

export default class FlashmapPlugin extends Plugin {
  name = 'FlashmapPlugin'

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

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
          const { stateModel } = pluggableElement
          const newStateModel = stateModel.extend(self => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                contextMenuItems() {
                  const feature = self.contextMenuFeature
                  if (!feature) {
                    // we're not adding any menu items since the click was not
                    // on a feature
                    return superContextMenuItems()
                  }
                  return [
                    ...superContextMenuItems(),
                    {
                      label: 'Sequence search against bucket',
                      onClick: () => {
                        console.log('Dummy mashmap results')
                      },
                    },
                  ]
                },
              },
            }
          })

          pluggableElement.stateModel = newStateModel
        }
        return pluggableElement
      },
    )

    // pluginManager.addRpcMethod(() => new BigsiQueryRPC(pluginManager))
  }
}
