import {
  EmbedProvider,
  Highlights,
  NavButton,
  Scalebar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/react-linear-genome-view2'

const calls = [
  {
    id: 'SV_75',
    type: 'Deletion, 19.9 kb',
    gene: 'CDKN2A',
    alleleFraction: '0.97',
    refName: 'chr9',
    start: 21952492,
    end: 21972343,
  },
  {
    id: 'SV_20',
    type: 'Junction to chr13',
    gene: 'CLSTN2',
    alleleFraction: '0.37',
    refName: 'chr3',
    start: 139976413,
    end: 139976414,
  },
  {
    id: 'SV_190',
    type: 'Junction to chr3',
    gene: 'none',
    alleleFraction: '0.37',
    refName: 'chr13',
    start: 114353243,
    end: 114353244,
  },
] as const

type Call = (typeof calls)[number]

function highlightOf({ id, refName, start, end }: Call) {
  return { refName, start, end, label: id }
}

function locOf({ refName, start, end }: Call) {
  const pad = Math.max(5000, end - start)
  return `${refName}:${start - pad}..${end + pad}`
}

const cell: React.CSSProperties = { padding: '2px 10px', textAlign: 'left' }

const Calls = observer(function Calls({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const shown = view.highlights[0]?.label
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        fontSize: '0.8rem',
        marginBottom: 8,
      }}
    >
      <thead>
        <tr>
          {['Call', 'Event', 'Gene', 'Allele fraction'].map(heading => (
            <th key={heading} style={cell}>
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {calls.map(call => (
          <tr
            key={call.id}
            aria-selected={shown === call.id}
            style={{
              background:
                shown === call.id
                  ? 'color-mix(in srgb, CanvasText 12%, transparent)'
                  : undefined,
            }}
          >
            <td style={cell}>
              <NavButton
                view={view}
                loc={locOf(call)}
                highlight={[highlightOf(call)]}
              >
                {call.id}
              </NavButton>
            </td>
            <td style={cell}>{call.type}</td>
            <td style={cell}>{call.gene}</td>
            <td style={cell}>{call.alleleFraction}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

const TableOfCalls = observer(function TableOfCalls() {
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
        displayDefaults: { height: 90, geneGlyphMode: 'representative' },
      },
      {
        trackId: 'hg008_tumor_hifi',
        name: 'HG008-T PacBio HiFi reads',
        uri: 'https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam',
        displayDefaults: { height: 240 },
      },
    ],
    view: {
      loc: locOf(calls[0]),
      tracks: ['hg38_genes', 'hg008_tumor_hifi'],
      highlight: [highlightOf(calls[0])],
    },
  })
  if (!state) {
    return null
  }
  const { view } = state.session
  return (
    <EmbedProvider session={state.session}>
      <Calls view={view} />
      <TrackStack view={view}>
        <Scalebar view={view} />
        <Highlights view={view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default TableOfCalls
