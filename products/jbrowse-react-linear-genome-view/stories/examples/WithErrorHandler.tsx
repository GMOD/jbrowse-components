import React, { useEffect, useState } from 'react'
import { ErrorMessage } from '@jbrowse/core/ui'

// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { getVolvoxConfig } from './util'

type ViewState = ReturnType<typeof createViewState>

export const WithErrorHandler = () => {
  const { assembly } = getVolvoxConfig()
  const [error, setError] = useState<unknown>()
  const [viewState, setViewState] = useState<ViewState>()

  useEffect(() => {
    try {
      const state = createViewState({
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
      setViewState(state)
    } catch (e) {
      setError(e)
    }
  }, [assembly])
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
