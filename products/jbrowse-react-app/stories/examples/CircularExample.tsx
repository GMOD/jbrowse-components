// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const CircularExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox structural variants (circular)',
          views: [
            {
              id: 'circular_view',
              type: 'CircularView',
              init: {
                assembly: 'volvox',
                tracks: ['volvox_sv_test'],
              },
            },
          ],
        },
      },
    }),
  )

  return (
    <>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/CircularExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </>
  )
}
