import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { getVolvoxConfig } from './util'

export const WithShowTrack = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  // this is the 'showTrack' method on the linear genome view
  // full reference https://jbrowse.org/jb2/docs/models/lineargenomeview/#action-showtrack
  state.session.view.showTrack('volvox-long-reads-sv-bam')

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithShowTrack.tsx">
        Source code
      </a>
    </div>
  )
}
