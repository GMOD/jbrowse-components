import { useEffect, useState } from 'react'

import { useCreateOnce } from '@jbrowse/core/util/hooks'
import {
  JBrowseCircularGenomeView,
  createViewState,
  decodeSession,
  encodeSession,
} from '@jbrowse/react-circular-genome-view2'

type ViewState = ReturnType<typeof createViewState>

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
    type: 'VariantTrack',
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
    },
  },
]

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
  // empty session first and then replaced. With no session to decode there is
  // nothing to wait for, so build the normal starting state right here rather
  // than rendering nothing and setting it from the effect below.
  //
  // `useCreateOnce`, not a `useState` initializer, and this is the one page on
  // the site where the difference has teeth: React double-invokes an
  // initializer under StrictMode and throws the SECOND result away, so an
  // engine built in one is orphaned per mount — alive, fetching, and with
  // nothing left holding it. The sibling examples get this from
  // `useCreateViewState`; this one cannot, because whether there is an engine
  // to build at all depends on the URL.
  const initial = useCreateOnce(() =>
    readSessionParam() ? undefined : createViewState({ assembly, tracks }),
  )
  const [state, setState] = useState<ViewState | undefined>(initial)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const param = readSessionParam()
    if (!param) {
      return
    }
    // The same trap one level out: StrictMode runs this effect twice, so
    // without the guard both passes decode and both build an engine, and the
    // first is orphaned the moment the second `setState` lands.
    let cancelled = false
    decodeSession(param)
      .then(session => {
        if (cancelled) {
          return
        }
        // `session` is the slot for a snapshot whose shape is only known at
        // runtime; `defaultSession` is for one you author and want checked
        setState(createViewState({ assembly, tracks, session }))
        setStatus(`restored "${session.name}" from the URL`)
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return
        }
        // a truncated or hand-edited link shouldn't strand the user on a
        // blank view: fall back to the normal starting state and say so
        console.error(e)
        setState(createViewState({ assembly, tracks }))
        setStatus(`could not restore the session in the URL: ${e}`)
      })
    return () => {
      cancelled = true
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
        {status || 'show a track or rotate the view, then save'}
      </div>
      <JBrowseCircularGenomeView viewState={state} />
    </div>
  ) : null
}
