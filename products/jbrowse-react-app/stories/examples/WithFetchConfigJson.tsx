import React, { useEffect, useState } from 'react'

// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app'
import { addRelativeUris } from './util'
import { createViewState, JBrowseApp } from '../../src'

type ViewState = ReturnType<typeof createViewState>

export const WithFetchConfigJson = () => {
  const [state, setState] = useState<ViewState>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const url = 'test_data/volvox/config.json'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching config ${url}`)
      }
      const config = await response.json()
      const configPath = 'test_data/volvox/config.json'
      addRelativeUris(config, new URL(configPath, window.location.href).href)
      const state = createViewState({
        config,
      })
      setState(state)
    })()
  }, [])

  return !state ? null : (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/WithFetchConfigJson.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
