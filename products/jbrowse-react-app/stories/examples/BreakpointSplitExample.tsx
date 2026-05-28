// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const BreakpointSplitExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox breakpoint split view',
          views: [
            {
              id: 'breakpoint_split_view',
              type: 'BreakpointSplitView',
              init: {
                views: [
                  {
                    loc: 'ctgA:1-5000',
                    assembly: 'volvox',
                    tracks: ['volvox_sv_cram'],
                  },
                  {
                    loc: 'ctgB:1-5000',
                    assembly: 'volvox',
                    tracks: ['volvox_sv_cram'],
                  },
                ],
              },
            },
          ],
        },
      },
    }),
  )

  return (
    <>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/BreakpointSplitExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </>
  )
}
