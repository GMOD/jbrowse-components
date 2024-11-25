/* eslint-disable no-console */
import React from 'react'
import Plugin from '@jbrowse/core/Plugin'
import { getVolvoxConfig } from './util'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import type PluginManager from '@jbrowse/core/PluginManager'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

// in your code
// import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'

// I call this small class a 'locally defined' plugin
class HighlightRegionPlugin extends Plugin {
  name = 'HighlightRegionPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',

      (pluggableElement: any) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(self => {
            const superRubberBandMenuItems = self.rubberBandMenuItems
            return {
              views: {
                rubberBandMenuItems() {
                  return [
                    ...superRubberBandMenuItems(),
                    {
                      label: 'Console log selected region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        const selectedRegions = self.getSelectedRegions(
                          leftOffset,
                          rightOffset,
                        )
                        // console log the list of potentially multiple
                        // regions that were selected
                        console.log(selectedRegions)
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

export const WithInlinePlugins = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    plugins: [HighlightRegionPlugin],
    tracks,
    location: 'ctgA:1105..1221',
  })

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInlinePlugins.tsx">
        Source code
      </a>
    </div>
  )
}
