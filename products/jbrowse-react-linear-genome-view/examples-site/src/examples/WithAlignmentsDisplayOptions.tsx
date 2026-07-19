import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// GRCh38 (hg38). The hosted alias file maps chr-prefixed names onto the fasta's
// bare "1".."22" refNames, so navigating with `chr15` resolves.
const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  sequence: {
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

// HG002 nanopore reads at the imprinted SNRPN locus, basecalled with 5mC
// modification tags (MM/ML) and haplotagged (HP tag).
const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'hg002_snrpn_5mc',
    name: 'HG002 SNRPN 5mC (haplotagged nanopore)',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'BamAdapter',
      uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
    },
  },
]

export default function WithAlignmentsDisplayOptions() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        loc: 'chr15:24,954,000..24,972,000',
        tracks: [
          {
            trackId: 'hg002_snrpn_5mc',
            // Every key in displaySnapshot below is a LinearAlignmentsDisplay
            // config slot. Coloring by 5mC modifications and grouping reads by
            // their HP (haplotype) tag reveals the allele-specific methylation
            // that marks the imprinted SNRPN DMR. See the config/model docs
            // linked from the writeup for the full option set.
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 500,
              colorBy: {
                type: 'modifications',
                modifications: { fillUnmarked: true },
              },
              groupBy: { type: 'tag', tag: 'HP' },
              // exclude secondary/supplementary/duplicate/QC-fail reads
              // (0x4 | 0x100 | 0x200 | 0x400 | 0x800)
              filterBy: { flagInclude: 0, flagExclude: 3844 },
            },
          },
        ],
      }}
    />
  )
}
