import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

export default function WithSessionHighlights() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      aliases: ['GRCh38'],
      sequence: {
        adapter: {
          type: 'BgzipFastaAdapter',
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        },
      },
      refNameAliases: {
        adapter: {
          type: 'RefNameAliasAdapter',
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      },
    },
    tracks: [
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
    ],
    defaultSession: {
      name: 'Session highlights',
      view: {
        type: 'LinearGenomeView',
        // highlights authored on the view snapshot carry per-highlight color
        // and label, and round-trip through saved sessions. compare with
        // init.highlight, which only accepts plain loc-strings
        highlight: [
          {
            assemblyName: 'hg38',
            refName: 'chr1',
            start: 11_130_000,
            end: 11_145_000,
            color: 'rgba(255, 0, 0, 0.25)',
            label: 'Region of interest',
          },
          {
            assemblyName: 'hg38',
            refName: 'chr1',
            start: 11_200_000,
            end: 11_220_000,
            color: 'rgba(0, 128, 255, 0.25)',
            label: 'Promoter',
          },
        ],
        init: {
          loc: 'chr1:11,106,077-11,261,675',
          assembly: 'hg38',
          tracks: [
            {
              trackId: 'ncbi-refseq-genes',
              displaySnapshot: { height: 200 },
            },
          ],
        },
      },
    },
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
