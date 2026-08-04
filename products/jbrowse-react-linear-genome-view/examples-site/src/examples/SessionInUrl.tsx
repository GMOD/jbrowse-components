import { useEffect, useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
  decodeSession,
  encodeSession,
} from '@jbrowse/react-linear-genome-view2'

import type { SessionSnapshot } from '@jbrowse/react-linear-genome-view2'

type ViewState = ReturnType<typeof createViewState>

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
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1..50000',
      tracks: ['volvox_gff3'],
    },
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

export default function SessionInUrl() {
  // undefined while the URL is being decoded, so the view isn't built with an
  // empty session first and then replaced
  const [state, setState] = useState<ViewState>()
  const [status, setStatus] = useState('')

  useEffect(() => {
    const param = readSessionParam()
    const build = (session?: SessionSnapshot) =>
      createViewState({
        assembly,
        tracks,
        // `session` is the slot for a snapshot whose shape is only known at
        // runtime; `defaultSession` is for one you author and want checked
        session,
        defaultSession: session ? undefined : freshSession,
      })
    if (param) {
      decodeSession(param)
        .then(session => {
          setState(build(session))
          setStatus(`restored "${session.name}" from the URL`)
        })
        .catch((e: unknown) => {
          // a truncated or hand-edited link shouldn't strand the user on a
          // blank view: fall back to the normal starting state and say so
          console.error(e)
          setState(build())
          setStatus(`could not restore the session in the URL: ${e}`)
        })
    } else {
      setState(build())
    }
  }, [])

  return state ? (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              const encoded = await encodeSession(state)
              writeSessionParam(encoded)
              setStatus(
                `saved to the URL (${encoded.length} chars) — copy the address bar, or reload to restore it`,
              )
            })()
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
