import { useRef, useState } from 'react'

import { JBrowse } from '@jbrowse/react-app2'

import type { ViewModel } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

// a track config you want to add at runtime instead of up front — it could be
// any track config object, e.g. one a user built or fetched
const genesTrackConf = {
  type: 'FeatureTrack',
  trackId: 'volvox_genes',
  name: 'Volvox genes',
  assemblyNames: ['volvox'],
  adapter: { type: 'Gff3TabixAdapter', uri: `${base}/volvox.sort.gff3.gz` },
}

export default function AddTracksProgrammatically() {
  // ref to the live engine, for imperative control after launch
  const ref = useRef<ViewModel>(null)
  const [added, setAdded] = useState(false)

  function addTrack() {
    const state = ref.current
    if (state) {
      state.jbrowse.addTrackConf(genesTrackConf)
      state.session.views[0]?.showTrack('volvox_genes')
      setAdded(true)
    }
  }

  return (
    <div>
      <button
        disabled={added}
        onClick={() => {
          addTrack()
        }}
      >
        {added ? 'Genes track added' : 'Add genes track'}
      </button>
      <JBrowse
        ref={ref}
        assemblies={assemblies}
        tracks={[]}
        sessionName="Programmatic tracks"
        views={[
          {
            type: 'LinearGenomeView',
            init: { assembly: 'volvox', loc: 'ctgA:1..50000' },
          },
        ]}
      />
    </div>
  )
}
