import React from 'react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../src'
import { getVolvoxConfig } from './util'

export const Example = () => {
  const { assembly } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks: [
      {
        type: 'QuantitativeTrack',
        trackId: 'google_bigwig',
        name: 'Google Drive BigWig',
        category: ['Authentication'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: {
            locationType: 'UriLocation',
            uri: ' https://www.googleapis.com/drive/v3/files/1PIvZCOJioK9eBL1Vuvfa4L_Fv9zTooHk?alt=media',
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
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/gmod/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/withinternetaccounts.stories.tsx">
        source code
      </a>
    </div>
  )
}

export default { title: 'Source: With internet accounts' }
