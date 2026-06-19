import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function DotplotExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox dotplot (self-vs-self)',
          views: [
            {
              id: 'dotplot_view',
              type: 'DotplotView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
                tracks: ['volvox_fake_synteny'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
