import React from 'react'
import { createViewState, JBrowseApp } from '@jbrowse/react-app'

import assembly from './assembly'
import tracks from './tracks'

export default function App() {
  const state = createViewState({
    config: {
      assemblies: [assembly],
      tracks,
    },
  })

  return <JBrowseApp viewState={state} />
}
