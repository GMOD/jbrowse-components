import { isFeature } from '@jbrowse/core/util/simpleFeature'
import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const hidden = new Set([
  'refName',
  'start',
  'end',
  'strand',
  'type',
  'name',
  'uniqueId',
])

const FeatureDetails = observer(function FeatureDetails({
  session,
}: {
  session: { selection: unknown; clearSelection: () => void }
}) {
  const { selection } = session
  if (!isFeature(selection)) {
    return <div style={{ padding: 12, opacity: 0.7 }}>Click a gene.</div>
  }
  const data = selection.toJSON()
  const rows = Object.entries(data).filter(
    ([key, value]) =>
      !hidden.has(key) && value !== null && typeof value !== 'object',
  )
  return (
    <div style={{ padding: 12, fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{data.name ?? data.type ?? 'Feature'}</strong>
        <button
          type="button"
          onClick={() => {
            session.clearSelection()
          }}
        >
          Clear
        </button>
      </div>
      <div style={{ opacity: 0.75 }}>
        {data.refName}:{data.start.toLocaleString()}-{data.end.toLocaleString()}
      </div>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '2px 10px',
        }}
      >
        {rows.map(([key, value]) => (
          <div key={key} style={{ display: 'contents' }}>
            <dt style={{ opacity: 0.7 }}>{key}</dt>
            <dd style={{ margin: 0, wordBreak: 'break-word' }}>
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
})

const YourOwnFeatureDetails = observer(function YourOwnFeatureDetails() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
    tracks: [
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 180 },
      },
    ],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_genes'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <div style={{ display: 'flex' }}>
        <TrackStack view={session.view} style={{ flex: 1, minWidth: 0 }} />
        <div
          style={{
            width: 260,
            flex: 'none',
            overflow: 'auto',
            borderLeft:
              '1px solid color-mix(in srgb, currentColor 25%, transparent)',
          }}
        >
          <FeatureDetails session={session} />
        </div>
      </div>
    </EmbedProvider>
  )
})

export default YourOwnFeatureDetails
