import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function SvInspectorExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox SV inspector',
          views: [
            {
              id: 'sv_inspector_view',
              type: 'SvInspectorView',
              init: {
                assembly: 'volvox',
                uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
