import React from 'react'

// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app'
import { addRelativeUris } from './util'
import config from '../../public/test_data/volvox/config.json'
import { createViewState, JBrowseApp } from '../../src'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const WithImportConfigJson = () => {
  const state = createViewState({
    config,
  })
  state.session.views[0]?.showTrack('volvox_cram')

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/WithImportConfigJson.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
