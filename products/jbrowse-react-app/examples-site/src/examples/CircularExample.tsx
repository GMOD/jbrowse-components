import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function CircularExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
          type: 'CircularView',
          init: {
            assembly: 'volvox',
            tracks: ['volvox_sv_test'],
          },
        },
      ]}
    />
  )
}
