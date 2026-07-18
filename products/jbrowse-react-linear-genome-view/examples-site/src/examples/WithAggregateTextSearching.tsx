import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithAggregateTextSearching() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      sequence: {
        adapter: {
          type: 'TwoBitAdapter',
          uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
        },
      },
    },
    aggregateTextSearchAdapters: [
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'volvox-index',
        ixFilePath: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox.ix',
        },
        ixxFilePath: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox.ixx',
        },
        metaFilePath: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox_meta.json',
        },
        assemblyNames: ['volvox'],
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        // trackId matches the `--fileId` baked into the index, so search hits
        // (e.g. type "EDEN" in the location box) both navigate and open the
        // right track
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
