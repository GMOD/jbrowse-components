import { useEffect, useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewStateAsync,
  decodeSession,
  destroyViewState,
  encodeSession,
} from '@jbrowse/react-linear-genome-view2'

import type {
  SessionSnapshot,
  ViewModel,
} from '@jbrowse/react-linear-genome-view2'

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
  name: 'Session in URL',
  view: {
    type: 'LinearGenomeView',
    assembly: 'volvox',
    loc: 'ctgA:1..50000',
    tracks: ['volvox_gff3'],
  },
}

function readSessionParam() {
  return (
    new URLSearchParams(window.location.hash.slice(1)).get('session') ??
    undefined
  )
}

function writeSessionParam(value: string) {
  const params = new URLSearchParams(window.location.hash.slice(1))
  params.set('session', value)
  window.history.replaceState(null, '', `#${params.toString()}`)
}

function build(session?: SessionSnapshot) {
  return createViewStateAsync({
    assembly,
    tracks,
    session,
    defaultSession: session ? undefined : freshSession,
  })
}

export default function SessionInUrl() {
  const [state, setState] = useState<ViewModel | undefined>(undefined)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const mount = {
      unmounted: false,
      engine: undefined as ViewModel | undefined,
    }
    const open = (session?: SessionSnapshot) =>
      build(session).then(
        engine => {
          if (mount.unmounted) {
            destroyViewState(engine)
          } else {
            mount.engine = engine
            setState(engine)
          }
        },
        (e: unknown) => {
          console.error(e)
          setStatus(`could not open the view: ${e}`)
        },
      )
    const param = readSessionParam()
    if (param) {
      decodeSession(param)
        .then(session =>
          open(session).then(() => {
            setStatus(`restored "${session.name}" from the URL`)
          }),
        )
        .catch((e: unknown) => {
          console.error(e)
          void open()
          setStatus(`could not restore the session in the URL: ${e}`)
        })
    } else {
      void open()
    }
    return () => {
      mount.unmounted = true
      if (mount.engine) {
        destroyViewState(mount.engine)
      }
    }
  }, [])

  return state ? (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        <button
          type="button"
          onClick={() => {
            void encodeSession(state)
              .then(encoded => {
                writeSessionParam(encoded)
                setStatus(
                  `saved to the URL (${encoded.length} chars) — copy the address bar, or reload to restore it`,
                )
              })
              .catch((e: unknown) => {
                console.error(e)
                setStatus(`could not save the session to the URL: ${e}`)
              })
          }}
        >
          Save this view to the URL
        </button>{' '}
        {status || 'navigate or toggle a track, then save'}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  ) : null
}
