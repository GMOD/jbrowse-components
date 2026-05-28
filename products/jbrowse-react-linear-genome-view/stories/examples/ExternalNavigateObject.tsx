import { useState } from 'react'

import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const hits = [
  { label: 'gene1', refName: 'ctgA', start: 1050, end: 9000 },
  { label: 'gene2', refName: 'ctgA', start: 20000, end: 23000 },
  { label: 'gene3', refName: 'ctgB', start: 100, end: 1500 },
]

export const ExternalNavigateObject = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1,000..5,000',
    }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {hits.map(h => (
          <button
            key={h.label}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view
                .navToLocations([
                  { refName: h.refName, start: h.start, end: h.end },
                ])
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ExternalNavigateObject.tsx">
        Source code
      </a>
    </div>
  )
}
