import { useEffect, useState } from 'react'

import { getSnapshot, onSnapshot } from '@jbrowse/mobx-state-tree'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

const STORAGE_KEY = 'jbrowse-lgv-example-session'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
    assembly: 'volvox',
    loc: 'ctgA:1105..1221',
    tracks: ['volvox_gff3'],
  },
}

export default function WithSessionPersistence() {
  const [state] = useState(() => {
    // the session snapshot references trackIds/assembly by name, so it restores
    // against the same `assembly`/`tracks` config passed on every load. It goes
    // in `session` rather than `defaultSession`: what comes back out of storage
    // is only known at runtime, and that is the slot MST validates
    const saved = localStorage.getItem(STORAGE_KEY)
    // and it is dropped *before* being used, because a snapshot this build can
    // no longer open takes the render down with it — the reset button below
    // included — and with the entry still in storage every reload after it
    // fails the same way. The effect below puts it back once a render has
    // actually committed, so the reload the user was going to try is the fix.
    localStorage.removeItem(STORAGE_KEY)
    try {
      return createViewState({
        assembly,
        tracks,
        // `session`, not `defaultSession`: what comes back out of storage is
        // only known at runtime, and that is the slot MST validates
        session: saved ? JSON.parse(saved) : undefined,
        defaultSession: freshSession,
      })
    } catch (e) {
      // unparseable, or a snapshot MST rejected outright
      console.error(e)
      return createViewState({ assembly, tracks, defaultSession: freshSession })
    }
  })

  // an effect, so this only runs on a render that committed. onSnapshot fires
  // after each action — mirror the live session into localStorage so pans,
  // zooms and track toggles survive a reload — but write once up front too,
  // since a load where nothing happens still has a session worth keeping
  useEffect(() => {
    const save = (snap: unknown) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
    }
    save(getSnapshot(state.session))
    return onSnapshot(state.session, save)
  }, [state])

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
