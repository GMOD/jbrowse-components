import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithPerTrackTextSearching() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'gff3tabix_genes',
        name: 'GFF3Tabix genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        textSearching: {
          textSearchAdapter: {
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/gff3tabix_genes.ix',
          },
        },
      },
    ],
    location: 'ctgA:1..800',
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
