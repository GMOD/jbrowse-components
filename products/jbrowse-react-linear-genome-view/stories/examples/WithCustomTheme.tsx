import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

export const WithCustomTheme = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    configuration: {
      theme: {
        palette: {
          bases: {
            A: { main: '#98FB98' },
            C: { main: '#87CEEB' },
            G: { main: '#DAA520' },
            T: { main: '#DC143C' },
          },
          primary: {
            main: '#311b92',
          },
          quaternary: {
            main: '#d50000',
          },
          secondary: {
            main: '#0097a7',
          },
          tertiary: {
            main: '#f57c00',
          },
        },
      },
    },
    tracks,
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithCustomTheme.tsx">
        Source code
      </a>
    </div>
  )
}
