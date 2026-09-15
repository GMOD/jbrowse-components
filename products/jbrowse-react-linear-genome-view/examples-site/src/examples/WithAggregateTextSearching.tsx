import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithAggregateTextSearching() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    aggregateTextSearchAdapters: [
      {
        type: 'TrixTextSearchAdapter',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox.ix',
        assemblyNames: ['volvox'],
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        name: 'Volvox genes',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      },
    ],
    location: 'ctgA:1..800',
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
