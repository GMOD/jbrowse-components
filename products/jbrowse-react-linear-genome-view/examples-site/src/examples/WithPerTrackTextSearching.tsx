import { useState } from 'react'
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
]

export default function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'gff3tabix_genes',
          assemblyNames: ['volvox'],
          name: 'GFF3Tabix genes',
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
            },
            index: {
              location: {
                uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
              },
            },
          },
          textSearching: {
            textSearchAdapter: {
              type: 'TrixTextSearchAdapter',
              textSearchAdapterId: 'gff3tabix_genes-index',
              ixFilePath: {
                uri: 'https://example.com/storybook_data/gff3tabix_genes.ix',
              },
              ixxFilePath: {
                uri: 'https://example.com/storybook_data/gff3tabix_genes.ixx',
              },
              metaFilePath: {
                uri: 'https://example.com/storybook_data/gff3tabix_genes_meta.json',
              },
              assemblyNames: ['volvox'],
            },
          },
        },
      ],
      location: 'ctgA:1..800',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
