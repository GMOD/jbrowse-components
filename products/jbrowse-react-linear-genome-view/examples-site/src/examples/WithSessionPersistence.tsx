import { useState } from 'react'

import { onSnapshot } from '@jbrowse/mobx-state-tree'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

const STORAGE_KEY = 'jbrowse-lgv-example-session'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

const freshSession = {
  name: 'Persisted session',
  view: {
    type: 'LinearGenomeView',
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1105..1221',
      tracks: ['volvox_gff3'],
    },
  },
}

export default function WithSessionPersistence() {
  const [state] = useState(() => {
    // the session snapshot references trackIds/assembly by name, so it restores
    // against the same `assembly`/`tracks` config passed on every load
    const saved = localStorage.getItem(STORAGE_KEY)
    const s = createViewState({
      assembly,
      tracks,
      defaultSession: saved ? JSON.parse(saved) : freshSession,
    })
    // onSnapshot fires after each action — mirror the live session into
    // localStorage so pans, zooms and track toggles survive a page reload
    onSnapshot(s.session, snap => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
    })
    return s
  })
  return (
    <div>
      <p>
        Pan, zoom, or toggle tracks, then reload the page — the view comes back
        where you left it.{' '}
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            location.reload()
          }}
        >
          Reset saved session
        </button>
      </p>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
