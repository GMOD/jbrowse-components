// replace with from '@jbrowse/react-circular-genome-view2' in your code
import { useState } from 'react'

import { JBrowseCircularGenomeView, createViewState } from '../../src/index.ts'

export const ShowTrack = () => {
  const [state] = useState(() => {
    const s = createViewState({
      assembly: {
        name: 'volvox',
        aliases: ['vvx'],
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'test_data/volvox/volvox.2bit',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'FromConfigAdapter',
            adapterId: 'W6DyPGJ0UU',
            features: [
              { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A', 'contigA'] },
              { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B', 'contigB'] },
            ],
          },
        },
      },
      tracks: [
        {
          type: 'VariantTrack',
          trackId: 'volvox_sv_test',
          name: 'volvox structural variant test',
          category: ['VCF'],
          assemblyNames: ['volvox'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
          },
        },
      ],
    })
    // open a track imperatively instead of via defaultSession.view.init
    s.session.view.showTrack('volvox_sv_test')
    return s
  })

  return (
    <div>
      <JBrowseCircularGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/stories/examples/ShowTrack.tsx">
        Source code
      </a>
    </div>
  )
}
