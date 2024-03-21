import React from 'react'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const DefaultSession = () => {
  // this default session loads an alignments track at startup
  const defaultSession = {
    id: 'wBejr9mPa',
    name: 'Integration test example 2/25/2021, 9:11:35 AM',
    view: {
      bpPerPx: 0.05,
      displayedRegions: [
        {
          assemblyName: 'volvox',
          end: 50001,
          refName: 'ctgA',
          reversed: false,
          start: 0,
        },
      ],
      id: 'integration_test',
      offsetPx: 2000,
      tracks: [
        {
          configuration: 'volvox-long-reads-sv-bam',
          displays: [
            {
              configuration: 'volvox-long-reads-sv-bam-LinearAlignmentsDisplay',
              id: 'CGblPB7sB0',
              type: 'LinearAlignmentsDisplay',
            },
          ],
          id: 'mCKjn5ta9',
          type: 'AlignmentsTrack',
        },
      ],
      type: 'LinearGenomeView',
    },
  }
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    defaultSession,
    location: 'ctgA:1105..1221',
    tracks,
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
