import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

type ViewState = ReturnType<typeof createViewState>

export default function WithErrorHandler() {
  // createViewState builds the whole model synchronously, so it either hands
  // back an engine or throws — there is no third, still-loading state
  const [result] = useState<{ viewState: ViewState } | { error: unknown }>(
    () => {
      try {
        return {
          viewState: createViewState({
            assembly: {
              name: 'volvox',
              uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
            },
            tracks: [
              {
                type: 'BadTrack',
                notProperTrack: 'error',
                shouldHaveTrackIdAndStuff: 'test',
              },
            ],
            location: 'ctgA:1105..1221',
          }),
        }
      } catch (error) {
        return { error }
      }
    },
  )
  return 'error' in result ? (
    <ErrorBanner error={result.error} />
  ) : (
    <JBrowseLinearGenomeView viewState={result.viewState} />
  )
}
