import {
  useCreateViewState,
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
  const state = useCreateViewState({
    assembly,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'google_bigwig',
        name: 'Google Drive BigWig',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            locationType: 'UriLocation',
            uri: 'https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
            internetAccountId: 'manualGoogleEntry',
          },
        },
      },
    ],
    location: 'ctgA:1105..1221',
    internetAccounts: [
      {
        type: 'ExternalTokenInternetAccount',
        internetAccountId: 'manualGoogleEntry',
        name: 'Google Drive Manual Token Entry',
        description: 'Manually enter a token to access Google Drive files',
        tokenType: 'Bearer',
      },
    ],
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
