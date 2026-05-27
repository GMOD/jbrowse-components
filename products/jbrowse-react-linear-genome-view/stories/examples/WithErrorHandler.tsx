import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithErrorHandler = () => {
  const { assembly } = getVolvoxConfig()
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
  return (
    <div>
      {error ? (
        <ErrorBanner error={error} />
      ) : viewState ? (
        <JBrowseLinearGenomeView viewState={viewState} />
      ) : (
        'Loading...'
      )}
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithErrorHandler.tsx">
        Source code
      </a>
    </div>
  )
}
