import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// the volvox config includes both 'volvox' and 'volvox_del' assemblies and a
// 'volvox_del.paf' synteny track
export default function SyntenyExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox vs Volvox Del synteny',
          views: [
            {
              id: 'synteny_view',
              type: 'LinearSyntenyView',
              init: {
                views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
                tracks: ['volvox_del.paf'],
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
