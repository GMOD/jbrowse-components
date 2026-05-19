// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

// The genes track — not in the initial config, added at runtime
const genesTrackConf = config.tracks.find(t => t.trackId === 'gff3tabix_genes')!

export const AddTracksProgrammatically = () => {
  const [added, setAdded] = useState(false)

  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: config.assemblies,
        // start with a minimal track list (no genes track)
        tracks: config.tracks.filter(t => t.trackId !== 'gff3tabix_genes'),
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
    // addTrackConf registers a track whose format is identical to a track
    // entry in jbrowse-web's config.json
    state.jbrowse.addTrackConf(genesTrackConf)
    state.session.views[0]?.showTrack('gff3tabix_genes')
    setAdded(true)
  }

  return (
    <div>
      <button disabled={added} onClick={addTrack}>
        {added ? 'Genes track added' : 'Add genes track'}
      </button>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/AddTracksProgrammatically.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
