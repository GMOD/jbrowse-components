import {
  EmbedProvider,
  Highlights,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useViewSvgFigure } from '@jbrowse/plugin-linear-genome-view'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const Figure = observer(function Figure({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const { figure, height, locstring, skipped, error, isLoading } =
    useViewSvgFigure(view)
  const caption = error
    ? `Could not draw the figure: ${error instanceof Error ? error.message : String(error)}`
    : locstring
      ? [
          `SVG of ${locstring}`,
          ...skipped.map(t => `no SVG renderer for ${t}`),
        ].join(' — ')
      : isLoading
        ? 'Drawing'
        : 'Nothing to draw'
  return (
    <div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7, padding: '6px 0' }}>
        {caption}
      </div>
      <div style={{ minHeight: height }}>{figure}</div>
    </div>
  )
})

const SvgFigure = observer(function SvgFigure() {
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
    ],
    view: {
      loc: 'chr17:43,000,000..43,170,000',
      tracks: ['hg38_phylop', 'hg38_genes'],
      highlight: [
        {
          assemblyName: 'hg38',
          refName: 'chr17',
          start: 43044295,
          end: 43125364,
          label: 'BRCA1',
        },
      ],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <TrackStack view={session.view}>
        <Highlights view={session.view} />
      </TrackStack>
      <Figure view={session.view} />
    </EmbedProvider>
  )
})

export default SvgFigure
