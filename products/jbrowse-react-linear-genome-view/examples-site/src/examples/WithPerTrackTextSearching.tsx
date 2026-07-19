import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithPerTrackTextSearching() {
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
            // point `uri` at the `.ix`; the `.ixx` and `_meta.json` are derived
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/gff3tabix_genes.ix',
            assemblyNames: ['volvox'],
          },
        },
      },
    ],
    location: 'ctgA:1..800',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
