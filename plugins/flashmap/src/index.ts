import React from 'react'
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
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getSession } from '@jbrowse/core/util'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import ZoomInIcon from '@material-ui/icons/ZoomIn'

import BigsiDialog from './components/BigsiDialog'
import { BigsiQueryRPC } from './BigsiRPC/rpcMethods'

export default class extends Plugin {
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
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(
            (self: LinearGenomeViewModel) => {
              const superRubberBandMenuItems = self.rubberBandMenuItems
              return {
                actions: {
                  activateSequenceSearchDialog() {
                    const session = getSession(self)
                    console.log(session)
                  },
                },
                views: {
                  rubberBandMenuItems() {
                    const newRubberBandMenuItems = [
                      ...superRubberBandMenuItems(),
                      {
                        label: 'Sequence Search',
                        icon: ZoomInIcon,
                        onClick: () => {
                          const { leftOffset, rightOffset } = self
                          const selectedRegions = self.getSelectedRegions(
                            leftOffset,
                            rightOffset,
                          )
                          console.log(selectedRegions)
                        },
                      },
                    ]

                    return newRubberBandMenuItems
                  },
                },
              }
            },
          )

          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )

    pluginManager.addRpcMethod(() => new BigsiQueryRPC(pluginManager))
  }
}
