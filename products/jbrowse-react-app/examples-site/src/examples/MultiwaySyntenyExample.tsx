import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// A three-row synteny view: volvox_ins — volvox — volvox_del. Each adjacent
// pair of rows is tied together by its own pairwise PAF track, so `tracks` is
// an array per band — tracks[i] connects views[i] and views[i+1].
export default function MultiwaySyntenyExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
          type: 'LinearSyntenyView',
          init: {
            views: [
              { assembly: 'volvox_ins' },
              { assembly: 'volvox' },
              { assembly: 'volvox_del' },
            ],
            tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
          },
        },
      ]}
    />
  )
}
