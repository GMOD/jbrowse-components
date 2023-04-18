import React from 'react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

export const HumanExomeExample = () => {
  const assembly = {
    name: 'GRCh38',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'GRCh38-ReferenceSequenceTrack',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
        },
        faiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
        },
        gziLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
        },
      },
    },
    aliases: ['hg38'],
    refNameAliases: {
      adapter: {
        type: 'RefNameAliasAdapter',
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
      },
    },
  }

  const tracks = [
    {
      type: 'FeatureTrack',
      trackId:
        'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
      name: 'NCBI RefSeq Genes',
      category: ['Genes'],
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
        index: {
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
          },
        },
      },
    },
    {
      type: 'AlignmentsTrack',
      trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
      name: 'NA12878 Exome',
      category: ['1000 Genomes', 'Alignments'],
      assemblyNames: ['GRCh38'],
      adapter: {
        type: 'CramAdapter',
        cramLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
          locationType: 'UriLocation',
        },
        craiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
          locationType: 'UriLocation',
        },

        // CRAM decoding requires a copy of the assembly's sequence adapter
        // BAM files without MD tags also require the sequenceAdapter
        sequenceAdapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
            locationType: 'UriLocation',
          },
          faiLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
            locationType: 'UriLocation',
          },
          gziLocation: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
            locationType: 'UriLocation',
          },
        },
      },
    },
  ]

  const state = createViewState({
    assembly,
    tracks,
    location: '1:100,987,269..100,987,368',
  })
  state.session.view.showTrack('NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome')

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/HumanExomeExample.tsx">
        Source code
      </a>
    </div>
  )
}
