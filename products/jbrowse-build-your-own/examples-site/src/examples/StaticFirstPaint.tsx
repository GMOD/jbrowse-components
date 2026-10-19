import { lazy } from 'react'

import { PosterFirst } from '@jbrowse/display-ui/embed'

const View = lazy(async () => {
  const { EmbedProvider, Scalebar, TrackStack } =
    await import('@jbrowse/display-ui/embed')
  const { useCreateViewState } =
    await import('@jbrowse/react-linear-genome-view2')
  const { observer } = await import('mobx-react')
  return {
    default: observer(function View() {
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
            trackId: 'hg38-ncbi-refseq-curated',
            name: 'NCBI RefSeq Curated',
            uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
            index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
          },
          {
            trackId: 'hg38_phylop',
            name: 'phyloP 100-way conservation',
            uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
            displayDefaults: { height: 100, color: '#3a7ca5' },
          },
        ],
        view: {
          loc: 'chr17:43,044,295..43,125,364',
          tracks: ['hg38-ncbi-refseq-curated', 'hg38_phylop'],
        },
      })
      if (!state) {
        return null
      }
      const { session } = state
      return (
        <EmbedProvider session={session}>
          <TrackStack view={session.view}>
            <Scalebar view={session.view} />
          </TrackStack>
        </EmbedProvider>
      )
    }),
  }
})

export default function StaticFirstPaint() {
  return (
    <PosterFirst
      poster={{
        src: '/storybook/byo/static-first-paint.png',
        width: 800,
        height: 220,
      }}
      alt="NCBI RefSeq genes and phyloP conservation across BRCA1"
    >
      <View />
    </PosterFirst>
  )
}
