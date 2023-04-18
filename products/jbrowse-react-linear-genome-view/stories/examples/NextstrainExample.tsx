import React from 'react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import nextstrainConfig from '../../public/nextstrain_covid.json'

export const NextstrainExample = () => {
  const { assembly, tracks, defaultSession } = nextstrainConfig
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'SARS-CoV-2:1..29,903',
    configuration: {
      theme: {
        palette: {
          primary: {
            main: '#5da8a3',
          },
          secondary: {
            main: '#333',
          },
        },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/NextstrainExample.tsx">
        Source code
      </a>
    </div>
  )
}
