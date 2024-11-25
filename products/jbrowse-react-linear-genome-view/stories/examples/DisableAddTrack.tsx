import React from 'react'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { getVolvoxConfig } from './util'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

export const DisableAddTrack = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/DisableAddTrack.tsx">
        Source code
      </a>
    </div>
  )
}
