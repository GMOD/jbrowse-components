import { useState } from 'react'

import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const wiggleTrackId = 'volvox_microarray'

export const WithInitWiggleDisplay = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Wiggle display config',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'ctgA:1105..3000',
            assembly: 'volvox',
            tracks: [
              {
                trackId: wiggleTrackId,
                displaySnapshot: {
                  type: 'LinearWiggleDisplay',
                  defaultRendering: 'line',
                  height: 150,
                },
              },
            ],
          },
        },
      },
    }),
  )
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInitWiggleDisplay.tsx">
        Source code
      </a>
    </div>
  )
}
