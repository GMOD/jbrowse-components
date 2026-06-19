import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

// a track config you want to add at runtime instead of up front (here pulled
// from the volvox config, but it could be any track config object)
const genesTrackConf = volvoxConfig.tracks.find(
  t => t.trackId === 'gff3tabix_genes',
)!

export default function AddTracksProgrammatically() {
  const [added, setAdded] = useState(false)

  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: volvoxConfig.assemblies,
        tracks: volvoxConfig.tracks.filter(
          t => t.trackId !== 'gff3tabix_genes',
        ),
        defaultSession: {
          name: 'Programmatic tracks',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
              },
            },
          ],
        },
      },
    }),
  )

  function addTrack() {
    state.jbrowse.addTrackConf(genesTrackConf)
    state.session.views[0]?.showTrack('gff3tabix_genes')
    setAdded(true)
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
      <JBrowseApp viewState={state} />
    </div>
  )
}
