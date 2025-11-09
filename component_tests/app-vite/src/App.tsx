import { createViewState, JBrowseApp } from '@jbrowse/react-app2'

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
