import { useState } from 'react'

import { refNameMismatchMessage } from '@jbrowse/core/assemblyManager/assembly'
import { indexCandidateNames } from '@jbrowse/core/util/indexCandidates'
import {
  UNKNOWN,
  UNSUPPORTED,
  guessAdapter,
  guessTrackType,
  storeBlobLocation,
} from '@jbrowse/core/util/tracks'
import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

type Session = ViewModel['session']

const notice: React.CSSProperties = {
  background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
  borderLeft: '3px solid #d97706',
  padding: '6px 10px',
  fontSize: '0.8rem',
}

function register(file: File) {
  const location = storeBlobLocation({ blob: file })
  if (!('blobId' in location)) {
    throw new Error(`could not register ${file.name}`)
  }
  return location
}

function openFiles(session: Session, files: File[]) {
  const { view } = session
  const indexOf = (data: File) =>
    files.find(f => indexCandidateNames(data.name).includes(f.name))
  const indexes = new Set(files.map(indexOf))
  for (const data of files.filter(f => !indexes.has(f))) {
    const index = indexOf(data)
    const location = register(data)
    const adapter = guessAdapter(
      location,
      index ? register(index) : undefined,
      undefined,
      view,
    )
    if (adapter.type === UNKNOWN || adapter.type === UNSUPPORTED) {
      throw new Error(`No loaded plugin reads "${data.name}"`)
    }
    const trackId = `local-${location.blobId}`
    session.addSessionTrackConf({
      trackId,
      type: guessTrackType(adapter.type, view, location),
      name: data.name,
      assemblyNames: ['hg38'],
      adapter,
    })
    void view.launchTrack(trackId)
  }
}

async function fetchDemoBam() {
  const base =
    'https://jbrowse.org/demos/cgiab/HG008-T_chr10_CUZD1_deletion.bam'
  return Promise.all(
    [base, `${base}.bai`].map(async url => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`could not fetch ${url}: ${response.status}`)
      }
      return new File([await response.arrayBuffer()], url.split('/').pop()!)
    }),
  )
}

function otherGenomeBed() {
  return new File(
    ['2L\t1000\t5000\tACME1\n2L\t8000\t9000\tACME2\n2R\t2000\t6000\tACME3\n'],
    'other-genome.bed',
  )
}

const FilePicker = observer(function FilePicker({
  session,
}: {
  session: Session
}) {
  const [error, setError] = useState<unknown>()
  const [busy, setBusy] = useState(false)
  const open = (files: File[]) => {
    setError(undefined)
    try {
      openFiles(session, files)
    } catch (e) {
      setError(e)
    }
  }
  const mismatches = session.view.tracks.flatMap(t =>
    t.refNameMismatch
      ? [{ id: t.id, message: refNameMismatchMessage(t.refNameMismatch) }]
      : [],
  )
  return (
    <div style={{ display: 'grid', gap: 6, paddingBottom: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          type="file"
          multiple
          aria-label="Open files"
          onChange={event => {
            open([...(event.target.files ?? [])])
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            fetchDemoBam()
              .then(open)
              .catch(setError)
              .finally(() => {
                setBusy(false)
              })
          }}
        >
          {busy ? 'Fetching…' : 'Open a BAM for me'}
        </button>
        <button
          type="button"
          onClick={() => {
            open([otherGenomeBed()])
          }}
        >
          Open a file from another genome
        </button>
      </div>
      {error ? (
        <div role="alert" style={notice}>
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : null}
      {mismatches.map(({ id, message }) => (
        <div key={id} style={notice}>
          {message}
        </div>
      ))}
    </div>
  )
})

const LocalFiles = observer(function LocalFiles() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
    ],
    view: {
      loc: 'chr10:122,831,700..122,840,800',
      tracks: ['hg38_genes'],
    },
  })
  return state ? (
    <EmbedProvider session={state.session}>
      <FilePicker session={state.session} />
      <TrackStack view={state.session.view} />
    </EmbedProvider>
  ) : null
})

export default LocalFiles
