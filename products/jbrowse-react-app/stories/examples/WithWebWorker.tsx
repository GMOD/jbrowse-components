import React from 'react'

// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app'
import volvoxConfig from '../../public/test_data/volvox/config.json'
import { createViewState, JBrowseApp } from '../../src'
// replace with this in your code:
// import makeWorkerInstance from '@jbrowse/react-app/esm/makeWorkerInstance'
import makeWorkerInstance from '../../src/makeWorkerInstance'

const defaultSession = {
  name: 'Integration test example',
  views: [
    {
      id: 'integration_test',
      type: 'LinearGenomeView',
      offsetPx: 1200,
      bpPerPx: 1,
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 50001,
          assemblyName: 'volvox',
        },
      ],
    },
  ],
  widgets: {
    hierarchicalTrackSelector: {
      id: 'hierarchicalTrackSelector',
      type: 'HierarchicalTrackSelectorWidget',
      filterText: '',
      view: 'integration_test',
    },
  },
  activeWidgets: {
    hierarchicalTrackSelector: 'hierarchicalTrackSelector',
  },
}

export const WithWebWorker = () => {
  const state = createViewState({
    config: {
      ...volvoxConfig,
      configuration: {
        rpc: {
          defaultDriver: 'WebWorkerRpcDriver',
        },
      },
      defaultSession,
    },
    makeWorkerInstance,
  })
  state.session.views[0]?.showTrack('Deep sequencing')

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/WithWebWorker.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
