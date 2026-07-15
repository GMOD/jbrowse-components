import { useRef, useState } from 'react'

import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

import type { ViewModel } from '@jbrowse/react-app2'

// a track config you want to add at runtime instead of up front (here pulled
// from the volvox config, but it could be any track config object)
const genesTrackConf = volvoxConfig.tracks.find(
  t => t.trackId === 'gff3tabix_genes',
)!

export default function AddTracksProgrammatically() {
  // ref to the live engine, for imperative control after launch
  const ref = useRef<ViewModel>(null)
  const [added, setAdded] = useState(false)

  function addTrack() {
    const state = ref.current
    if (state) {
      state.jbrowse.addTrackConf(genesTrackConf)
      state.session.views[0]?.showTrack('gff3tabix_genes')
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
        assemblies={volvoxConfig.assemblies}
        tracks={volvoxConfig.tracks.filter(
          t => t.trackId !== 'gff3tabix_genes',
        )}
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
