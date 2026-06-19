import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function CircularExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
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

  return <JBrowseApp viewState={state} />
}
