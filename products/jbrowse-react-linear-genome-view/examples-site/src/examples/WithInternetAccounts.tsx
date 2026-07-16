import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithInternetAccounts() {
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
