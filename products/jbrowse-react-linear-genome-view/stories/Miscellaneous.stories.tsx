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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
        Source code
      </a>
    </div>
  )
}

export const WithOutsideStyling = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })

  return (
    <div style={{ textAlign: 'center', fontFamily: 'monospace' }}>
      <p>
        This parent container has textAlign:&apos;center&apos; and a monospace
        font, but these attributes are not affecting the internal LGV
      </p>
      <p>
        The react component takes measures to avoid being affected by styles
        outside of it on the page. In this case, a font and a text align, which
        without measures could affect the jbrowse-react-linear-genome-view
        component, is fine here.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
        Source code
      </a>
    </div>
  )
}

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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
        Source code
      </a>
    </div>
  )
}

export const WithLongReads = () => {
  // this default session loads an alignments track at startup
  const defaultSession = {
    id: 'wBejr9mPa',
    name: 'Integration test example 2/25/2021, 9:11:35 AM',
    view: {
      id: 'integration_test',
      type: 'LinearGenomeView',
      offsetPx: 2000,
      bpPerPx: 0.05,
      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 50001,
          reversed: false,
          assemblyName: 'volvox',
        },
      ],
      tracks: [
        {
          id: 'mCKjn5ta9',
          type: 'AlignmentsTrack',
          configuration: 'volvox-long-reads-sv-bam',
          displays: [
            {
              id: 'CGblPB7sB0',
              type: 'LinearAlignmentsDisplay',
              configuration: 'volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
            },
          ],
        },
      ],
    },
  }
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'ctgA:1105..1221',
  })

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/Miscellaneous.stories.tsx">
        Source code
      </a>
    </div>
  )
}

export default { title: 'Source: Other miscellaneous examples' }
