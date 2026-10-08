import { useState } from 'react'

import {
  EmbedProvider,
  LocationBox,
  Toolbar,
  TrackStack,
  TrackToggle,
} from '@jbrowse/display-ui/embed'
import {
  createViewStateAsync,
  decodeSession,
  encodeSession,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const assembly = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
  geneticCodes: { chrM: 2 },
}

const tracks = [
  {
    trackId: 'hg38_phylop',
    name: 'phyloP 100-way conservation',
    uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
    displayDefaults: { height: 100, color: '#3a7ca5' },
  },
  {
    trackId: 'hg38_genes',
    name: 'RefSeq curated genes',
    uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
    index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
    displayDefaults: { height: 120 },
  },
]

const view = {
  loc: 'chr17:43,044,295..43,125,364',
  tracks: ['hg38_genes'],
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
  return createViewStateAsync({ assembly, tracks, view })
}

const SessionInUrl = observer(function SessionInUrl() {
  const [status, setStatus] = useState('')
  const state = useCreateViewState(() => build(setStatus))
  return state ? (
    <EmbedProvider session={state.session}>
      <Toolbar>
        <LocationBox view={state.session.view} />
        <TrackToggle view={state.session.view} trackId="hg38_phylop">
          Conservation
        </TrackToggle>
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
        </button>
        {status || 'navigate or toggle a track, then save'}
      </Toolbar>
      <TrackStack view={state.session.view} />
    </EmbedProvider>
  ) : null
})

export default SessionInUrl
