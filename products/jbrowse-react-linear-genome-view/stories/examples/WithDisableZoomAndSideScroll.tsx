import { useState } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import { types } from '@jbrowse/mobx-state-tree'

import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'
import type ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint<PluggableElementType>(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const view = pluggableElement as ViewType
          view.stateModel = types.compose(
            view.stateModel,
            types.model().actions(() => ({
              zoomTo: () => {},
              scrollTo: () => {},
            })),
          )
        }
        return pluggableElement
      },
    )
  }
  configure() {}
}
export const WithDisableZoomAndSideScroll = () => {
  const [state] = useState(() => {
    const { assembly, tracks } = getVolvoxConfig()
    return createViewState({
      assembly,
      tracks,
      plugins: [MyPlugin],
      location: 'ctgA:1105..1221',
    })
  })

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithDisableZoomAndSideScroll.tsx">
        Source code
      </a>
      (Note: This is a basic demo that was added for a user request and may not
      be a complete solution)
    </div>
  )
}
