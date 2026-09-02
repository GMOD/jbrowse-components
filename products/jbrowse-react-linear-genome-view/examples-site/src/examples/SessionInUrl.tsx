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

// what opens when the URL carries no session
const freshSession = {
  name: 'Session in URL',
  view: {
    type: 'LinearGenomeView',
    assembly: 'volvox',
    loc: 'ctgA:1..50000',
    tracks: ['volvox_gff3'],
  },
}

// The session goes in the hash fragment rather than the query string. The
// fragment is never sent to the server, so a long session can't overflow the
// request line (HTTP 414) — the same reason JBrowse Web keeps its own there.
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

// `createViewStateAsync`, because a session decoded from the URL carries
// whatever displays were open when it was saved, and a display's state model is
// a dynamic import until something asks for it. The synchronous
// `createViewState` says so rather than loading it.
function build(session?: SessionSnapshot) {
  return createViewStateAsync({
    assembly,
    tracks,
    // `session` is the slot for a snapshot whose shape is only known at
    // runtime; `defaultSession` is for one you author and want checked
    session,
    defaultSession: session ? undefined : freshSession,
  })
}

export default function SessionInUrl() {
  // undefined until the engine is built, which is now a wait either way:
  // `createViewStateAsync` resolves the state models the session names before
  // it builds anything.
  const [state, setState] = useState<ViewModel | undefined>(undefined)
  const [status, setStatus] = useState('')

  useEffect(() => {
    // The engine is not owned by React, so unmounting alone leaves its RPC
    // worker threads and its autoruns running — and a build can land after this
    // effect was torn down (in StrictMode it usually does), which would leave
    // one that nothing ever destroys. One box rather than two `let`s, because
    // the compiler's narrowing doesn't see through the cleanup.
    const mount = {
      unmounted: false,
      engine: undefined as ViewModel | undefined,
    }
    // the rejection handler is part of `open` rather than left to each caller:
    // both call sites below discard the promise, and a build that fails with no
    // handler on it is an unhandled rejection with nothing on screen to explain
    // it
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
          // a truncated or hand-edited link shouldn't strand the user on a
          // blank view: fall back to the normal starting state and say so
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
