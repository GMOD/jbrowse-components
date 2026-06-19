import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

import nextstrainConfig from './nextstrain_covid.json'

export default function NextstrainCovid() {
  const { assembly, tracks, defaultSession } = nextstrainConfig
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession,
      location: 'SARS-CoV-2:1..29,903',
      configuration: {
        theme: {
          palette: {
            primary: { main: '#5da8a3' },
            secondary: { main: '#333' },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
