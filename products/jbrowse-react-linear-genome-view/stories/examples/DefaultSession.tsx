import React from 'react'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const DefaultSession = () => {
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
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/DefeaultSession.tsx">
        Source code
      </a>
    </div>
  )
}
