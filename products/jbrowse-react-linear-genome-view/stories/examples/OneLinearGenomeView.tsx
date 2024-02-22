/* eslint-disable no-console */
import React from 'react'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const OneLinearGenomeView = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    // use 1-based coordinates for locstring
    location: 'ctgA:1105..1221',
    onChange: patch => {
      console.log('patch', patch)
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/OneLinearGenomeView.tsx">
        Source code
      </a>
    </div>
  )
}
