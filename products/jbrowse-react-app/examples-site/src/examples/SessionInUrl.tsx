import { useEffect, useState } from 'react'

import {
  JBrowseApp,
  decodeSession,
  encodeSession,
  useCreateViewState,
} from '@jbrowse/react-app2'

import type { SessionSnapshot } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const config = {
  assemblies: [{ name: 'volvox', uri: `${base}/volvox.2bit` }],
  tracks: [
    {
      type: 'FeatureTrack',
      trackId: 'volvox_gff3',
      name: 'Volvox genes',
      assemblyNames: ['volvox'],
      adapter: { type: 'Gff3TabixAdapter', uri: `${base}/volvox.sort.gff3.gz` },
    },
  ],
  // what opens with no session in the URL, and what File > New session returns
  // to. `<JBrowse>` spells this as a `views` prop; held as a config it is the
  // same snapshot, and it is what the restored session below layers on top of
  defaultSession: {
    name: 'Session in URL',
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

// The engine is built here rather than by `<JBrowse>` because the Save button
// below needs it *while rendering*, to close over it. A `ref` on `<JBrowse>`
// hands the engine back a render after mount, which is a render of the toolbar
// with a button that cannot do anything yet; holding the engine yourself means
// there is never a moment where it is missing. `<JBrowseApp>` is what the
// props component renders internally, so nothing is given up by dropping to it.
function App({ session, note }: { session?: SessionSnapshot; note: string }) {
  // undefined for the frame in which the engine is still being built: a
  // restored session names the view and display types that were open when it
  // was saved, and those state models load before the tree can be built
  const viewState = useCreateViewState({ config, session })
  const [status, setStatus] = useState(note)

  return viewState ? (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        {status || 'navigate or open a track, then save from the app toolbar'}
      </div>
      <JBrowseApp
        viewState={viewState}
        // your own controls, rendered in the app's toolbar beside the session
        // name — the slot JBrowse Web fills with its Share button. The button
        // has to be yours because only your app knows the URL its page is
        // served at, and whether that page restores a session at all.
        headerButtons={
          <button
            type="button"
            onClick={() => {
              void encodeSession(viewState)
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
            Save to URL
          </button>
        }
      />
    </div>
  ) : null
}

export default function SessionInUrl() {
  // undefined while the URL is being decoded, null once there is nothing to
  // restore — so the app isn't built with an empty session first and replaced.
  // With no session in the URL there is nothing to decode, so start at null
  // rather than rendering nothing and setting it from the effect below.
  const [session, setSession] = useState<SessionSnapshot | null | undefined>(
    () => (readSessionParam() ? undefined : null),
  )
  const [note, setNote] = useState('')

  useEffect(() => {
    const param = readSessionParam()
    if (!param) {
      return
    }
    decodeSession(param)
      .then(snap => {
        setSession(snap)
        setNote(`restored "${snap.name}" from the URL`)
      })
      .catch((e: unknown) => {
        // a truncated or hand-edited link shouldn't strand the user on a
        // blank app: fall back to the config's own views and say so
        console.error(e)
        setSession(null)
        setNote(`could not restore the session in the URL: ${e}`)
      })
  }, [])

  // the engine is built out of the decoded session, so it can't be built until
  // there is one — hence the separate component, mounted once we know
  return session === undefined ? null : (
    <App session={session ?? undefined} note={note} />
  )
}
