import { useEffect, useState } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import { types } from 'mobx-state-tree'

import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

import type PluginManager from '@jbrowse/core/PluginManager'

type ViewState = ReturnType<typeof createViewState>

class MyPlugin extends Plugin {
  name = 'MyPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: { name: string; stateModel: any }) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          pluggableElement.stateModel = types.compose(
            pluggableElement.stateModel,
            types.model().actions(_self => ({
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
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    const { assembly, tracks } = getVolvoxConfig()
    const state = createViewState({
      assembly,
      tracks,
      plugins: [MyPlugin],
      location: 'ctgA:1105..1221',
    })
    setState(state)
  }, [])

  return state ? (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithDisableZoomAndSideScroll.tsx">
        Source code
      </a>
      (Note: This is a basic demo that was added for a user request and may not
      be a complete solution)
    </div>
  ) : null
}
