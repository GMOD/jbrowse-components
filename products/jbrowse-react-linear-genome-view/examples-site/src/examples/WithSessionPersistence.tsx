import { useEffect } from 'react'

import { useCreateOnceAsync } from '@jbrowse/core/util/hooks'
import { getSnapshot, onSnapshot } from '@jbrowse/mobx-state-tree'
import {
  JBrowseLinearGenomeView,
  createViewStateAsync,
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
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1105..1221',
      tracks: ['volvox_gff3'],
    },
  },
}

// `createViewStateAsync`, because a stored session names the displays that were
// open when it was written, and a display's state model is a dynamic import
// until something asks for it. The synchronous `createViewState` says so rather
// than loading it — which is the same failure a stored snapshot this build can
// no longer open produces, and the catch below handles both alike.
async function build() {
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
    return await createViewStateAsync({
      assembly,
      tracks,
      session: saved ? JSON.parse(saved) : undefined,
      defaultSession: freshSession,
    })
  } catch (e) {
    // unparseable, or a snapshot MST rejected outright
    console.error(e)
    return createViewStateAsync({
      assembly,
      tracks,
      defaultSession: freshSession,
    })
  }
}

export default function WithSessionPersistence() {
  const state = useCreateOnceAsync(build)

  // an effect, so this only runs on a render that committed. onSnapshot fires
  // after each action — mirror the live session into localStorage so pans,
  // zooms and track toggles survive a reload — but write once up front too,
  // since a load where nothing happens still has a session worth keeping
  useEffect(() => {
    if (state) {
      const save = (snap: unknown) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
      }
      save(getSnapshot(state.session))
      return onSnapshot(state.session, save)
    }
    return undefined
  }, [state])

  return state ? (
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
  ) : null
}
