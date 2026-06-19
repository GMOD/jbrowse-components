import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function DarkTheme() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        configuration: {
          theme: {
            palette: {
              mode: 'dark',
            },
          },
        },
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
