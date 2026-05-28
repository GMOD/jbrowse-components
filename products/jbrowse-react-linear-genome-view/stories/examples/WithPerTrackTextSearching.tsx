// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { addRelativeUris, getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithPerTrackTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const [state] = useState(() => {
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
            uri: 'volvox.sort.gff3.gz',
          },
          textSearching: {
            textSearchAdapter: {
              type: 'TrixTextSearchAdapter',
              textSearchAdapterId: 'gff3tabix_genes-index',
              ixFilePath: { uri: 'storybook_data/gff3tabix_genes.ix' },
              ixxFilePath: { uri: 'storybook_data/gff3tabix_genes.ixx' },
              metaFilePath: { uri: 'storybook_data/gff3tabix_genes_meta.json' },
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
    return createViewState(textSearchConfig)
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithPerTrackTextSearching.tsx">
        Source code
      </a>
    </div>
  )
}
