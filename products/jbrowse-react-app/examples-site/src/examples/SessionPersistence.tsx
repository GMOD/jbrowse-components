import { useEffect } from 'react'

import { getSnapshot, onSnapshot } from '@jbrowse/mobx-state-tree'
import {
  JBrowseApp,
  createViewStateAsync,
  useCreateViewState,
} from '@jbrowse/react-app2'

const STORAGE_KEY = 'jbrowse-app-example-session'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const config = {
  assemblies: [
    { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
  ],
  tracks: [
    {
      trackId: 'volvox_gff3',
      name: 'Volvox genes',
      uri: `${base}/volvox.sort.gff3.gz`,
    },
  ],
  defaultSession: {
    name: 'Persisted session',
    views: [
      {
        id: 'view-0',
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1..50000',
        tracks: ['volvox_gff3'],
      },
    ],
  },
}

async function build() {
  const saved = localStorage.getItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY)
  try {
    return await createViewStateAsync({
      config,
      session: saved ? JSON.parse(saved) : undefined,
    })
  } catch (e) {
    console.error(e)
    return createViewStateAsync({ config })
  }
}

export default function SessionPersistence() {
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
    <JBrowseApp
      viewState={state}
      headerButtons={
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            location.reload()
          }}
        >
          Reset saved session
        </button>
      }
    />
  ) : null
}
