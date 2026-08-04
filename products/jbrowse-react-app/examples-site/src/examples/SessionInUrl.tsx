import { useEffect, useState } from 'react'

import { JBrowse, decodeSession, encodeSession } from '@jbrowse/react-app2'

import type { SessionSnapshot, ViewModel } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: { type: 'Gff3TabixAdapter', uri: `${base}/volvox.sort.gff3.gz` },
  },
]

// what opens with no session in the URL, and what File > New session returns to
const views = [
  {
    type: 'LinearGenomeView',
    init: {
      assembly: 'volvox',
      loc: 'ctgA:1..50000',
      tracks: ['volvox_gff3'],
    },
  },
]

// The session goes in the hash fragment rather than the query string. The
// fragment is never sent to the server, so a long session can't overflow the
// request line (HTTP 414) — the same reason jbrowse-web keeps its own there.
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
  // undefined while the URL is being decoded, null once there is nothing to
  // restore — so the app isn't built with an empty session first and replaced
  const [session, setSession] = useState<SessionSnapshot | null>()
  const [viewState, setViewState] = useState<ViewModel | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const param = readSessionParam()
    if (param) {
      decodeSession(param)
        .then(snap => {
          setSession(snap)
          setStatus(`restored "${snap.name}" from the URL`)
        })
        .catch((e: unknown) => {
          // a truncated or hand-edited link shouldn't strand the user on a
          // blank app: fall back to the declarative views and say so
          console.error(e)
          setSession(null)
          setStatus(`could not restore the session in the URL: ${e}`)
        })
    } else {
      setSession(null)
    }
  }, [])

  if (session === undefined) {
    return null
  }

  return (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            ;(async () => {
              if (viewState) {
                const encoded = await encodeSession(viewState)
                writeSessionParam(encoded)
                setStatus(
                  `saved to the URL (${encoded.length} chars) — copy the address bar, or reload to restore it`,
                )
              }
            })()
          }}
        >
          Save this view to the URL
        </button>{' '}
        {status || 'navigate or open a track, then save'}
      </div>
      <JBrowse
        ref={setViewState}
        assemblies={assemblies}
        tracks={tracks}
        views={views}
        session={session ?? undefined}
      />
    </div>
  )
}
