import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
}

export default function WithPerTrackTextSearching() {
  const state = useCreateViewState({
    assembly,
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        assemblyNames: ['volvox'],
        name: 'GFF3Tabix genes',
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
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
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
