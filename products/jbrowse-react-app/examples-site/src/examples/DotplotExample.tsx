import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function DotplotExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
          type: 'DotplotView',
          init: {
            views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
            tracks: ['volvox_fake_synteny'],
          },
        },
      ]}
    />
  )
}
