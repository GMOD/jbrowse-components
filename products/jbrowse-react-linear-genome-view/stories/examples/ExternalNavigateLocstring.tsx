import { useState } from 'react'

import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const bookmarks = [
  { label: 'ctgA — region A', loc: 'ctgA:1,000..5,000' },
  { label: 'ctgA — region B', loc: 'ctgA:20,000..25,000' },
  { label: 'ctgB — region C', loc: 'ctgB:1..2,000' },
]

export const ExternalNavigateLocstring = () => {
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
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view.navToLocString(b.loc).catch((e: unknown) => {
                console.error(e)
              })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ExternalNavigateLocstring.tsx">
        Source code
      </a>
    </div>
  )
}
