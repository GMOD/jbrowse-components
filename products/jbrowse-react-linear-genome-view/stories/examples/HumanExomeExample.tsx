import React from 'react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

export const HumanExomeExample = () => {
  const assembly = {
    aliases: ['hg38'],
    name: 'GRCh38',
    refNameAliases: {
      adapter: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        type: 'RefNameAliasAdapter',
      },
    },
    sequence: {
      adapter: {
        faiLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
        },
        fastaLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
        },
        gziLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
        },
        type: 'BgzipFastaAdapter',
      },
      trackId: 'GRCh38-ReferenceSequenceTrack',
      type: 'ReferenceSequenceTrack',
    },
  }

  const tracks = [
    {
      adapter: {
        gffGzLocation: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        },
        index: {
          location: {
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.tbi',
          },
        },
        type: 'Gff3TabixAdapter',
      },
      assemblyNames: ['GRCh38'],
      category: ['Genes'],
      name: 'NCBI RefSeq Genes',
      trackId:
        'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
      type: 'FeatureTrack',
    },
    {
      adapter: {
        craiLocation: {
          locationType: 'UriLocation',
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
        },
        cramLocation: {
          locationType: 'UriLocation',
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        },
        // CRAM decoding requires a copy of the assembly's sequence adapter
        // BAM files without MD tags also require the sequenceAdapter
        sequenceAdapter: {
          faiLocation: {
            locationType: 'UriLocation',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.fai',
          },
          fastaLocation: {
            locationType: 'UriLocation',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
          },
          gziLocation: {
            locationType: 'UriLocation',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz.gzi',
          },
          type: 'BgzipFastaAdapter',
        },

        type: 'CramAdapter',
      },
      assemblyNames: ['GRCh38'],
      category: ['1000 Genomes', 'Alignments'],
      name: 'NA12878 Exome',
      trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
      type: 'AlignmentsTrack',
    },
  ]

  const state = createViewState({
    assembly,
    location: '1:100,987,269..100,987,368',
    tracks,
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
