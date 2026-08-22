import { useEffect } from 'react'

import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
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
  // `useCreateViewState`, not `useState(() => createViewState(…))`: React
  // double-invokes a state initializer under StrictMode and throws the second
  // result away, which for an engine is a whole orphaned worker pool per mount.
  // It also destroys this one when the component unmounts.
  // undefined for the frame in which the engine is still being built: the
  // circular view's own state model is loaded on demand
  const state = useCreateViewState({ assembly, tracks })

  // open a track imperatively instead of via the init prop
  // launchTrack API: https://jbrowse.org/jb2/docs/models/circularview/#action-launchtrack
  //
  // In an effect rather than beside the construction above, which is what the
  // hook costs — and nothing is lost: the assembly is still a network round
  // trip away, so this lands long before there is anything to draw.
  // `launchTrack` resolves to the track it already added when it is already
  // shown, so StrictMode running this twice shows it once.
  useEffect(() => {
    void state?.session.view.launchTrack('volvox_sv_test')
  }, [state])

  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
