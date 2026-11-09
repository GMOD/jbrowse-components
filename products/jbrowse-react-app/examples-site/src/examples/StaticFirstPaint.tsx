import { lazy } from 'react'

import { PosterFirst } from '@jbrowse/display-ui/embed'

const JBrowse = lazy(async () => ({
  default: (await import('@jbrowse/react-app2')).JBrowse,
}))

const poster = {
  src: '/storybook/app/static-first-paint.png',
  width: 1000,
  height: 460,
}

export default function StaticFirstPaint() {
  return (
    <PosterFirst
      poster={poster}
      alt="NCBI RefSeq genes and phyloP conservation at SHH"
    >
      <style>{`.staticFirstPaint { --jbrowse-app-height: ${poster.height}px; }`}</style>
      <div className="staticFirstPaint">
        <JBrowse
          assemblies={[
            {
              name: 'hg38',
              uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
              refNameAliases: {
                uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
              },
            },
          ]}
          tracks={[
            {
              trackId: 'hg38-ncbi-refseq-curated',
              name: 'NCBI RefSeq Curated',
              uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
              index:
                'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
            },
            {
              trackId: 'hg38-phylop100way',
              name: 'phyloP 100-way',
              uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
            },
          ]}
          views={[
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              loc: 'chr7:155,799,529..155,812,871',
              tracks: ['hg38-ncbi-refseq-curated', 'hg38-phylop100way'],
            },
          ]}
        />
      </div>
    </PosterFirst>
  )
}
