import { useEffect } from 'react'

import { getSnapshot, onSnapshot } from '@jbrowse/mobx-state-tree'
import {
  JBrowseLinearGenomeView,
  createViewStateAsync,
  useCreateViewState,
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

async function build() {
  const saved = localStorage.getItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY)
  try {
    return await createViewStateAsync({
      assembly,
      tracks,
      session: saved ? JSON.parse(saved) : undefined,
      defaultSession: freshSession,
    })
  } catch (e) {
    console.error(e)
    return createViewStateAsync({
      assembly,
      tracks,
      defaultSession: freshSession,
    })
  }
}

export default function WithSessionPersistence() {
  const state = useCreateViewState(build)

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
