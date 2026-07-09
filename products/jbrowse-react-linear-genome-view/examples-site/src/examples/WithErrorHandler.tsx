import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
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

export default function App() {
  const [{ viewState, error }] = useState(() => {
    try {
      return {
        viewState: createViewState({
          assembly,
          tracks: [
            {
              type: 'BadTrack',
              notProperTrack: 'error',
              shouldHaveTrackIdAndStuff: 'test',
            },
          ],
          location: 'ctgA:1105..1221',
        }),
        error: undefined as unknown,
      }
    } catch (e) {
      return { viewState: undefined, error: e }
    }
  })
  return error ? (
    <ErrorBanner error={error} />
  ) : viewState ? (
    <JBrowseLinearGenomeView viewState={viewState} />
  ) : (
    'Loading...'
  )
}
