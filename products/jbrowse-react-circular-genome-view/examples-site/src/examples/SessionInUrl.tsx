import { useEffect, useState } from 'react'

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
  // empty session first and then replaced
  const [state, setState] = useState<ViewState>()
  const [status, setStatus] = useState('')

  useEffect(() => {
    const param = readSessionParam()
    if (param) {
      decodeSession(param)
        .then(session => {
          // `session` is the slot for a snapshot whose shape is only known at
          // runtime; `defaultSession` is for one you author and want checked
          setState(createViewState({ assembly, tracks, session }))
          setStatus(`restored "${session.name}" from the URL`)
        })
        .catch((e: unknown) => {
          // a truncated or hand-edited link shouldn't strand the user on a
          // blank view: fall back to the normal starting state and say so
          console.error(e)
          setState(createViewState({ assembly, tracks }))
          setStatus(`could not restore the session in the URL: ${e}`)
        })
    } else {
      setState(createViewState({ assembly, tracks }))
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
