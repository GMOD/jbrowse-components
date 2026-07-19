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
        // point `uri` at the `.ix`; the `.ixx` and `_meta.json` are derived
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox.ix',
        assemblyNames: ['volvox'],
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        // trackId matches the id baked into the index, so a search hit (type
        // "EDEN" in the location box) both navigates and opens this track
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
  return <JBrowseLinearGenomeView viewState={state} />
}
