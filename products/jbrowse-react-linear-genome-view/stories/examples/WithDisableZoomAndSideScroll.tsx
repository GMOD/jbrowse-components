import { useEffect, useState } from 'react'

import Plugin from '@jbrowse/core/Plugin'
import { types } from 'mobx-state-tree'

import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

import type PluginManager from '@jbrowse/core/PluginManager'

type ViewState = ReturnType<typeof createViewState>

class MyPlugin extends Plugin {
  name: 'MyPlugin'
  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      pluggableElement => {
        // @ts-expect-error
        if (pluggableElement.name === 'LinearGenomeView') {
          // @ts-expect-error
          pluggableElement.stateModel = types.compose(
            // @ts-expect-error
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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/DefeaultSession.tsx">
        Source code
      </a>
    </div>
  ) : null
}
