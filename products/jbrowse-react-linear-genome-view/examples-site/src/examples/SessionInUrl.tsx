import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewStateAsync,
  decodeSession,
  encodeSession,
  useCreateViewState,
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

const freshSession = {
  name: 'Session in URL',
  view: {
    type: 'LinearGenomeView',
    assembly: 'volvox',
    loc: 'ctgA:1..50000',
    tracks: ['volvox_gff3'],
  },
}

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

async function build(report: (status: string) => void) {
  const param = readSessionParam()
  if (param) {
    try {
      const session = await decodeSession(param)
      const engine = await createViewStateAsync({ assembly, tracks, session })
      report(`restored "${session.name}" from the URL`)
      return engine
    } catch (e) {
      console.error(e)
      report(`could not restore the session in the URL: ${e}`)
    }
  }
  return createViewStateAsync({
    assembly,
    tracks,
    defaultSession: freshSession,
  })
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
        {status || 'navigate or toggle a track, then save'}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  ) : null
}
