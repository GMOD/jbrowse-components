/**
 * Custom Theme
 *
 * Demonstrates theming by customizing colors for UI elements and DNA bases.
 * Shows Material-UI palette configuration for primary, secondary, and base colors.
 */

import { useState } from 'react'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithCustomTheme = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      configuration: {
        theme: {
          palette: {
            primary: {
              main: '#311b92',
            },
            secondary: {
              main: '#0097a7',
            },
            tertiary: {
              main: '#f57c00',
            },
            quaternary: {
              main: '#d50000',
            },
            bases: {
              A: { main: '#98FB98' },
              C: { main: '#87CEEB' },
              G: { main: '#DAA520' },
              T: { main: '#DC143C' },
            },
          },
        },
      },
    }),
  )
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithCustomTheme.tsx">
        Source code
      </a>
    </div>
  )
}
