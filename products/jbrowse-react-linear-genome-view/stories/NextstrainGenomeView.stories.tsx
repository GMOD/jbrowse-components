import React from 'react'
import { createViewState, JBrowseLinearGenomeView } from '../src'
import nextstrainConfig from '../public/nextstrain_covid.json'

const { assembly } = nextstrainConfig
const { tracks } = nextstrainConfig
const { defaultSession } = nextstrainConfig

export const NextstrainGenomeView = () => {
  const state = createViewState({
    assembly,
    tracks,
    defaultSession,
    location: 'Sars-Cov2:1..29,903',
    onChange: patch => {
      // eslint-disable-next-line no-console
      console.log('patch', patch)
    },
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
  return <JBrowseLinearGenomeView viewState={state} />
}

const NextstrainStory = {
  title: 'Nextstrain View',
}

export default NextstrainStory
