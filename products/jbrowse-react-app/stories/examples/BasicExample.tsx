import React from 'react'

// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app'
import { createViewState, JBrowseApp } from '../../src'

const config = {
  assemblies: [
    {
      name: 'volvox',
      refNameAliases: {
        adapter: {
          adapterId: 'W6DyPGJ0UU',
          features: [
            {
              aliases: ['A', 'contigA'],
              refName: 'ctgA',
              uniqueId: 'alias1',
            },
            {
              aliases: ['B', 'contigB'],
              refName: 'ctgB',
              uniqueId: 'alias2',
            },
          ],
          type: 'FromConfigAdapter',
        },
      },
      sequence: {
        adapter: {
          twoBitLocation: {
            locationType: 'UriLocation',
            uri: 'volvox.2bit',
          },
          type: 'TwoBitAdapter',
        },
        trackId: 'volvox_refseq',
        type: 'ReferenceSequenceTrack',
      },
    },
  ],

  defaultSession: {
    name: 'Integration test example',
    views: [
      {
        bpPerPx: 0.05,
        displayedRegions: [
          {
            assemblyName: 'volvox',
            end: 50001,
            refName: 'ctgA',
            start: 0,
          },
        ],
        id: 'integration_test',
        offsetPx: 2000,
        type: 'LinearGenomeView',
      },
    ],
  },
  tracks: [
    {
      adapter: {
        craiLocation: {
          locationType: 'UriLocation',
          uri: 'volvox-sorted.cram.crai',
        },
        cramLocation: {
          locationType: 'UriLocation',
          uri: 'volvox-sorted.cram',
        },
        sequenceAdapter: {
          twoBitLocation: {
            locationType: 'UriLocation',
            uri: 'volvox.2bit',
          },
          type: 'TwoBitAdapter',
        },
        type: 'CramAdapter',
      },
      assemblyNames: ['volvox'],
      category: ['Alignments'],
      name: 'volvox-sorted.cram',
      trackId: 'volvox_cram',
      type: 'AlignmentsTrack',
    },
  ],
}

export const BasicExample = () => {
  const state = createViewState({
    config,
  })
  state.session.views[0]?.showTrack('volvox_cram')

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/BasicExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
