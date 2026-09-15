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

async function build() {
  const param = readSessionParam()
  let session: Awaited<ReturnType<typeof decodeSession>> | undefined
  let status = ''
  if (param) {
    try {
      session = await decodeSession(param)
      status = `restored "${session.name}" from the URL`
    } catch (e) {
      console.error(e)
      status = `could not restore the session in the URL: ${e}`
    }
  }
  return { state: await createViewState({ assembly, tracks, session }), status }
}

export default function SessionInUrl() {
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
            void (async () => {
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
