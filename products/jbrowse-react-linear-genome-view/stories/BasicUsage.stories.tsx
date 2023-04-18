/* eslint-disable no-console */
import React from 'react'
import { createViewState, JBrowseLinearGenomeView } from '../src'
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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/BasicUsage.stories.tsx">
        Source code
      </a>
    </div>
  )
}

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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/BasicUsage.stories.tsx">
        Source code
      </a>
    </div>
  )
}

export const DisableAddTracks = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/BasicUsage.stories.tsx">
        Source code
      </a>
    </div>
  )
}

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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/BasicUsage.stories.tsx">
        Source code
      </a>
    </div>
  )
}

export default { title: 'Source: Basic usage' }
