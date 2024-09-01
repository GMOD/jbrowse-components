import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { getVolvoxConfig } from './util'

export const WithTwoLinearGenomeViews = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state1 = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  const state2 = createViewState({
    assembly,
    tracks,
    location: 'ctgA:5560..30589',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state1} />
      <JBrowseLinearGenomeView viewState={state2} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithTwoLinearGenomeViews.tsx">
        Source code
      </a>
    </div>
  )
}
