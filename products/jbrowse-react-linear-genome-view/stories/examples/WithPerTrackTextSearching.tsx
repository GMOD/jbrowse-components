import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { addRelativeUris, getVolvoxConfig } from './util'

export const WithPerTrackTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const textSearchConfig = {
    assembly,
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',

    tracks: [
      {
        adapter: {
          gffGzLocation: {
            locationType: 'UriLocation',
            uri: 'volvox.sort.gff3.gz',
          },
          index: {
            location: {
              locationType: 'UriLocation',
              uri: 'volvox.sort.gff3.gz.tbi',
            },
          },
          type: 'Gff3TabixAdapter',
        },
        assemblyNames: ['volvox'],
        category: ['Miscellaneous'],
        name: 'GFF3Tabix genes',
        textSearching: {
          textSearchAdapter: {
            assemblyNames: ['volvox'],
            ixFilePath: {
              locationType: 'UriLocation',
              uri: 'storybook_data/gff3tabix_genes.ix',
            },
            ixxFilePath: {
              locationType: 'UriLocation',
              uri: 'storybook_data/gff3tabix_genes.ixx',
            },
            metaFilePath: {
              locationType: 'UriLocation',
              uri: 'storybook_data/gff3tabix_genes_meta.json',
            },
            textSearchAdapterId: 'gff3tabix_genes-index',
            type: 'TrixTextSearchAdapter',
          },
        },
        trackId: 'gff3tabix_genes',
        type: 'FeatureTrack',
      },
    ],
  }
  const configPath = 'test_data/volvox/config.json'
  addRelativeUris(
    textSearchConfig,
    new URL(configPath, window.location.href).href,
  )
  const state = createViewState(textSearchConfig)
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithPerTrackTextSearching.tsx">
        Source code
      </a>
    </div>
  )
}
