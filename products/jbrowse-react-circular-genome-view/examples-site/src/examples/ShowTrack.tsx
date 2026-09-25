import { useEffect } from 'react'

import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
  const state = useCreateViewState({ assembly, tracks })

  useEffect(() => {
    void state?.session.view.launchTrack('volvox_sv_test')
  }, [state])

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
