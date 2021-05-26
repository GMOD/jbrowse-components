import React from 'react'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearGenomeView,
  ThemeProvider,
} from '../src'
import nextstrainConfig from '../public/nextstrain_covid.json'

const theme = createJBrowseTheme({
  palette: {
    primary: {
      main: '#5da8a3',
    },
    secondary: {
      main: '#333',
    },
  },
})

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
  })
  return (
    <ThemeProvider theme={theme}>
      <JBrowseLinearGenomeView viewState={state} />
    </ThemeProvider>
  )
}

const NextstrainStory = {
  title: 'Nextstrain View',
}

export default NextstrainStory
