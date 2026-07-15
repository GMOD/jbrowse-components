import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// the volvox config includes both 'volvox' and 'volvox_del' assemblies and a
// 'volvox_del.paf' synteny track
export default function SyntenyExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
          type: 'LinearSyntenyView',
          init: {
            views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
            tracks: ['volvox_del.paf'],
          },
        },
      ]}
    />
  )
}
