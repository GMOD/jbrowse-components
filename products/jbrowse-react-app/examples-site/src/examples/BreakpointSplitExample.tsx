import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// the volvox config includes a 'volvox_sv_cram' alignments track with SV reads
export default function BreakpointSplitExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
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
      ]}
    />
  )
}
