import React from 'react'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const UsingLocObject = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    // use 0-based coordinates for "location object" here
    location: { refName: 'ctgA', start: 10000, end: 20000 },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/UsingLocObject.tsx">
        Source code
      </a>
    </div>
  )
}
