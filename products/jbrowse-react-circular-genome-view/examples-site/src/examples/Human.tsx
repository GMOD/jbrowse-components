import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/hg19/hg19_aliases.txt',
  },
}

const tracks = [
  {
    trackId: 'pacbio_sv_vcf',
    name: 'HG002 Pacbio SV (VCF)',
    uri: 'https://jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
    category: ['GIAB'],
  },
]

export default function Human() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ tracks: ['pacbio_sv_vcf'] }}
    />
  )
}
