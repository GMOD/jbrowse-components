/**
 * Nextstrain SARS-CoV-2 demo
 *
 * Browses the SARS-CoV-2 genome in a style similar to https://nextstrain.org —
 * gene coloring matches their palette and an entropy track shows per-base
 * diversity. Both the sequence and feature tracks use FromConfigAdapter, so the
 * data is supplied inline as JSON rather than fetched from flat files.
 */

import { useState } from 'react'

import nextstrainConfig from '../../public/nextstrain_covid.json' with { type: 'json' }
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const NextstrainExample = () => {
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
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/NextstrainCovid.tsx">
        Source code
      </a>
    </div>
  )
}
