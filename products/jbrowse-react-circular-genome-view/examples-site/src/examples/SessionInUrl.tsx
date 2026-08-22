import { useState } from 'react'

import { useCreateOnceAsync } from '@jbrowse/core/util/hooks'
import {
  JBrowseCircularGenomeView,
  createViewState,
  decodeSession,
  encodeSession,
} from '@jbrowse/react-circular-genome-view2'

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

// One factory, run once, because whether there is a session to restore depends
// on the URL: the decode and the build are the same async step. `createViewState`
// is itself async — the circular view's state model is loaded on demand — so
// there is nothing to gain by splitting them.
async function build() {
  const param = readSessionParam()
  let session: Awaited<ReturnType<typeof decodeSession>> | undefined
  let status = ''
  if (param) {
    try {
      // `session` is the slot for a snapshot whose shape is only known at
      // runtime; `defaultSession` is for one you author and want checked
      session = await decodeSession(param)
      status = `restored "${session.name}" from the URL`
    } catch (e) {
      // a truncated or hand-edited link shouldn't strand the user on a
      // blank view: fall back to the normal starting state and say so
      console.error(e)
      status = `could not restore the session in the URL: ${e}`
    }
  }
  return { state: await createViewState({ assembly, tracks, session }), status }
}

export default function SessionInUrl() {
  // `useCreateOnceAsync`, not a `useState` initializer, and this is the one
  // page on the site where the difference has teeth: React double-invokes an
  // initializer under StrictMode and throws the SECOND result away, so an
  // engine built in one is orphaned per mount — alive, fetching, and with
  // nothing left holding it. The sibling examples get this from
  // `useCreateViewState`; this one cannot, because whether there is an engine
  // to build at all depends on the URL.
  const built = useCreateOnceAsync(build)
  const [saved, setSaved] = useState('')
  const state = built?.state
  const status = saved || built?.status

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
              setSaved(
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
