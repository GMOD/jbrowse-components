// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import Plugin from '@jbrowse/core/Plugin'

import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: any) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(self => {
            const superItems = self.rubberBandMenuItems
            return {
              views: {
                rubberBandMenuItems() {
                  return [
                    ...superItems(),
                    {
                      label: 'Console log selected region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        // eslint-disable-next-line no-console
                        console.log(
                          JSON.stringify(
                            self.getSelectedRegions(leftOffset, rightOffset),
                          ),
                        )
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
  }

  configure() {}
}

export const EmbeddedPlugin = () => {
  const [state] = useState(() =>
    createViewState({
      config,
      plugins: [HighlightRegionPlugin],
    }),
  )

  return <JBrowseApp viewState={state} />
}
