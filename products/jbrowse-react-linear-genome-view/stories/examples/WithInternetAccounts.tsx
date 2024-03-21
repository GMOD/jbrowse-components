import React from 'react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const WithInternetAccounts = () => {
  const { assembly } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    internetAccounts: [
      {
        description: 'Manually enter a token to access Google Drive files',
        internetAccountId: 'manualGoogleEntry',
        name: 'Google Drive Manual Token Entry',
        tokenType: 'Bearer',
        type: 'ExternalTokenInternetAccount',
      },
    ],
    location: 'ctgA:1105..1221',
    tracks: [
      {
        adapter: {
          bigWigLocation: {
            internetAccountId: 'manualGoogleEntry',
            locationType: 'UriLocation',
            uri: ' https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
          },
          type: 'BigWigAdapter',
        },
        assemblyNames: ['volvox'],
        category: ['Authentication'],
        name: 'Google Drive BigWig',
        trackId: 'google_bigwig',
        type: 'QuantitativeTrack',
      },
    ],
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInternetAccounts.tsx">
        Source code
      </a>
    </div>
  )
}
