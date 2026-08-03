import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithInit() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit',
        refNameAliases: {
          uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.chromAlias.txt',
        },
        cytobands: {
          uri: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBandIdeo.txt.gz',
        },
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'hg38-ncbi-refseq-curated',
          name: 'NCBI RefSeq Curated',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
            csi: true,
          },
        },
      ]}
      init={{
        loc: 'chr7:155,799,529..155,812,871',
        tracks: ['hg38-ncbi-refseq-curated'],
      }}
    />
  )
}
