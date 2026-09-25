import { useState } from 'react'

import {
  JBrowseCircularGenomeView,
  createViewState,
  decodeSession,
  encodeSession,
  useCreateViewState,
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
      const engine = await createViewState({ assembly, tracks, session })
      report(`restored "${session.name}" from the URL`)
      return engine
    } catch (e) {
      console.error(e)
      report(`could not restore the session in the URL: ${e}`)
    }
  }
  return createViewState({ assembly, tracks })
}

export default function SessionInUrl() {
  const [status, setStatus] = useState('')
  const state = useCreateViewState(() => build(setStatus))

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
        {status || 'show a track or rotate the view, then save'}
      </div>
      <JBrowseCircularGenomeView viewState={state} />
    </div>
  ) : null
}
