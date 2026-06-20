import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// the volvox config includes a 'volvox_sv_cram' alignments track with SV reads
export default function BreakpointSplitExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox breakpoint split view',
          views: [
            {
              id: 'breakpoint_split_view',
              type: 'BreakpointSplitView',
              init: [
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
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
