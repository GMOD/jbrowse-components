import { useState } from 'react'

import {
  JBrowseCircularGenomeView,
  createViewState,
} from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
}

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
    },
  },
]

export default function ShowTrack() {
  const [state] = useState(() => {
    const s = createViewState({ assembly, tracks })
    // open a track imperatively instead of via defaultSession.view.init
    s.session.view.showTrack('volvox_sv_test')
    return s
  })
  return <JBrowseCircularGenomeView viewState={state} />
}
