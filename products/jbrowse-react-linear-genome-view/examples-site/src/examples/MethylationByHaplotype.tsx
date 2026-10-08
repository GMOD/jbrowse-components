import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

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
    trackId: 'hg38_genes',
    name: 'RefSeq curated genes',
    uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
    index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
    displayDefaults: { height: 90 },
  },
  {
    trackId: 'hg002_snrpn',
    name: 'HG002 ONT reads',
    uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
  },
]

export default function MethylationByHaplotype() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{
        loc: 'chr15:24,948,000..24,962,000',
        tracks: [
          'hg38_genes',
          {
            trackId: 'hg002_snrpn',
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 360,
              facet: 'tags.HP',
              baseColor: { field: 'modifications' },
              modifications: { fillUnmarked: true },
            },
          },
        ],
      }}
    />
  )
}
