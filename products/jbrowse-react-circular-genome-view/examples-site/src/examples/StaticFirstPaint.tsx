import { lazy } from 'react'

import { PosterFirst } from '@jbrowse/display-ui/embed'

const CircularGenomeView = lazy(async () => ({
  default: (await import('@jbrowse/react-circular-genome-view2'))
    .CircularGenomeView,
}))

export default function StaticFirstPaint() {
  return (
    <PosterFirst
      poster={{
        src: '/storybook/cgv/static-first-paint.png',
        width: 800,
        height: 406,
      }}
      alt="HG002 PacBio structural variants as chords around hg19"
    >
      <CircularGenomeView
        assembly={{
          name: 'hg19',
          uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
          refNameAliases: {
            uri: 'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
          },
        }}
        tracks={[
          {
            trackId: 'pacbio_sv_vcf',
            name: 'HG002 Pacbio SV (VCF)',
            uri: 'https://jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
          },
        ]}
        view={{ tracks: ['pacbio_sv_vcf'] }}
      />
    </PosterFirst>
  )
}
