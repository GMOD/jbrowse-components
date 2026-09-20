import {
  EmbedProvider,
  Highlights,
  Scalebar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
]

const cell: React.CSSProperties = { padding: '2px 10px', textAlign: 'left' }

const Calls = observer(function Calls({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const shown = view.highlight[0]?.label
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
        {calls.map(
          ({ id, type, gene, alleleFraction, refName, start, end }) => {
            const pad = Math.max(5000, end - start)
            return (
              <tr
                key={id}
                aria-selected={shown === id}
                style={{
                  cursor: 'pointer',
                  background:
                    shown === id
                      ? 'color-mix(in srgb, CanvasText 12%, transparent)'
                      : undefined,
                }}
                onClick={() => {
                  view.setHighlight([
                    { assemblyName: 'hg38', refName, start, end, label: id },
                  ])
                  view
                    .navToLocString(`${refName}:${start - pad}..${end + pad}`)
                    .catch((e: unknown) => {
                      console.error(e)
                    })
                }}
              >
                {[id, type, gene, alleleFraction].map(text => (
                  <td key={text} style={cell}>
                    {text}
                  </td>
                ))}
              </tr>
            )
          },
        )}
      </tbody>
    </table>
  )
})

const ATableOfCalls = observer(function ATableOfCalls() {
  const [first] = calls
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
        displayDefaults: { height: 90, geneGlyphMode: 'longestCoding' },
      },
      {
        trackId: 'hg008_tumor_hifi',
        name: 'HG008-T PacBio HiFi reads',
        uri: 'https://jbrowse.org/demos/cgiab/HG008-T_PacBio-HiFi-Revio_116x.demo_slices.bam',
        displayDefaults: { height: 240 },
      },
    ],
    view: {
      loc: 'chr9:21,932,000..21,993,000',
      tracks: ['hg38_genes', 'hg008_tumor_hifi'],
      highlight: [
        {
          assemblyName: 'hg38',
          refName: first!.refName,
          start: first!.start,
          end: first!.end,
          label: first!.id,
        },
      ],
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

export default ATableOfCalls
