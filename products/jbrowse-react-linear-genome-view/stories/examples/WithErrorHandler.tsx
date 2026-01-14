import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithErrorHandler = () => {
  const { assembly } = getVolvoxConfig()
  const [error, setError] = useState<unknown>()
  const [viewState] = useState(() => {
    try {
      return createViewState({
        assembly,
        tracks: [
          {
            type: 'BadTrack',
            notProperTrack: 'error',
            shouldHaveTrackIdAndStuff: 'test',
          },
        ],
        location: 'ctgA:1105..1221',
      })
    } catch (e) {
      setError(e)
      return undefined
    }
  })
  return (
    <div>
      {error ? (
        <ErrorMessage error={error} />
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
