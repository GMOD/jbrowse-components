import { useState } from 'react'

import {
  JBrowseApp,
  createViewStateAsync,
  decodeSession,
  encodeSession,
  useCreateViewState,
} from '@jbrowse/react-app2'

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

function writeSessionParam(value: string) {
  const params = new URLSearchParams(window.location.hash.slice(1))
  params.set('session', value)
  window.history.replaceState(null, '', `#${params.toString()}`)
}

async function build(report: (status: string) => void) {
  const param = new URLSearchParams(window.location.hash.slice(1)).get(
    'session',
  )
  if (param) {
    try {
      const session = await decodeSession(param)
      const engine = await createViewStateAsync({ config, session })
      report(`restored "${session.name}" from the URL`)
      return engine
    } catch (e) {
      console.error(e)
      report(`could not restore the session in the URL: ${e}`)
    }
  }
  return createViewStateAsync({ config })
}

export default function SessionInUrl() {
  const [status, setStatus] = useState('')
  const viewState = useCreateViewState(() => build(setStatus))

  return viewState ? (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        {status || 'navigate or open a track, then save from the app toolbar'}
      </div>
      <JBrowseApp
        viewState={viewState}
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
