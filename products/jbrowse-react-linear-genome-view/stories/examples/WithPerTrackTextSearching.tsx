import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { addRelativeUris, getVolvoxConfig } from './util'

export const WithPerTrackTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const textSearchConfig = {
    assembly,
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        assemblyNames: ['volvox'],
        name: 'GFF3Tabix genes',
        category: ['Miscellaneous'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'volvox.sort.gff3.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.sort.gff3.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
        textSearching: {
          textSearchAdapter: {
            type: 'TrixTextSearchAdapter',
            textSearchAdapterId: 'gff3tabix_genes-index',
            ixFilePath: {
              uri: 'storybook_data/gff3tabix_genes.ix',
              locationType: 'UriLocation',
            },
            ixxFilePath: {
              uri: 'storybook_data/gff3tabix_genes.ixx',
              locationType: 'UriLocation',
            },
            metaFilePath: {
              uri: 'storybook_data/gff3tabix_genes_meta.json',
              locationType: 'UriLocation',
            },
            assemblyNames: ['volvox'],
          },
        },
      },
    ],
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',
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
