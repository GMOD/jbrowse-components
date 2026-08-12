import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: props are initial values, the component owns the engine
export default function WithFeatureHighlights() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'ncbi-refseq-genes',
          name: 'NCBI RefSeq Genes',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
          },
        },
      ]}
      init={{
        loc: 'chr12:25,150,000-25,400,000',
        tracks: [
          {
            trackId: 'ncbi-refseq-genes',
            // `featureHighlights` is display STATE, not a config slot, so it
            // goes here rather than in the track's `displayDefaults` — a state
            // prop written onto a config is dropped in silence. Each entry
            // boxes one feature and holds it in a top row of the track.
            displaySnapshot: {
              height: 220,
              featureHighlights: [{ refName: 'chr12', name: 'KRAS' }],
            },
          },
        ],
      }}
    />
  )
}
