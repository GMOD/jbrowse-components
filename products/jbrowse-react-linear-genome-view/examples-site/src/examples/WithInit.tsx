import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithInit() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        cytobands: {
          uri: 'https://jbrowse.org/genomes/GRCh38/cytoBand.txt',
        },
        geneticCodes: { chrM: 2 },
      }}
      tracks={[
        {
          trackId: 'hg38-ncbi-refseq-curated',
          name: 'NCBI RefSeq Curated',
          uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
          index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        },
      ]}
      view={{
        loc: 'chr7:155,799,529..155,812,871',
        tracks: ['hg38-ncbi-refseq-curated'],
      }}
    />
  )
}
