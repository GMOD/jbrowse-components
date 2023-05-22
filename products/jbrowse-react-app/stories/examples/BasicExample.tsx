import React from 'react'

// replace with import {createViewState,JBrowseWebApp} from '@jbrowse/react-app' in your code
import { createViewState, JBrowseWebApp } from '../../src'
// replace with import makeWorkerInstance from '@jbrowse/react-app/esm/makeWorkerInstance' in your codea
import makeWorkerInstance from '../../src/makeWorkerInstance'
import volvoxConfig from '../../public/test_data/volvox/config.json'
import { addRelativeUris } from '../util'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(volvoxConfig, new URL(configPath, window.location.href).href)

const assemblies = volvoxConfig.assemblies
const tracks = volvoxConfig.tracks
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

export const BasicExample = () => {
  const state = createViewState({
    assemblies,
    tracks,
    defaultSession,
    makeWorkerInstance,
  })
  state.session.views[0]?.showTrack('Deep sequencing')

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/BasicExample.tsx">
        Source code
      </a>
      <JBrowseWebApp viewState={state} />
    </div>
  )
}
