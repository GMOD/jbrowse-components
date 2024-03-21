import React from 'react'

// replace with from '@jbrowse/react-circular-genome-view' in your code
import { createViewState, JBrowseCircularGenomeView } from '../../src'

const hg19Assembly = {
  aliases: ['GRCh37'],
  name: 'hg19',
  refNameAliases: {
    adapter: {
      location: {
        locationType: 'UriLocation',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
      },
      type: 'RefNameAliasAdapter',
    },
  },
  sequence: {
    adapter: {
      faiLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
      },
      fastaLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
      },
      gziLocation: {
        locationType: 'UriLocation',
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
      },
      type: 'BgzipFastaAdapter',
    },
    trackId: 'Pd8Wh30ei9R',
    type: 'ReferenceSequenceTrack',
  },
}

const hg19Tracks = [
  {
    adapter: {
      index: {
        location: {
          locationType: 'UriLocation',
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz.tbi',
        },
      },
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        locationType: 'UriLocation',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
      },
    },
    assemblyNames: ['hg19'],
    category: ['GIAB'],
    name: 'HG002 Pacbio SV (VCF)',
    trackId: 'pacbio_sv_vcf',
    type: 'VariantTrack',
  },
]

const hg19DefaultSession = {
  name: 'this session',
  view: {
    bpPerPx: 5000000,
    id: 'circularView',
    tracks: [
      {
        configuration: 'pacbio_sv_vcf',
        displays: [
          {
            configuration: 'pacbio_sv_vcf-ChordVariantDisplay',
            id: 'v9QVAR3oaB',
            type: 'ChordVariantDisplay',
          },
        ],
        id: 'uPdLKHik1',
        type: 'VariantTrack',
      },
    ],
    type: 'CircularView',
  },
}

export const Human = () => {
  const state = createViewState({
    assembly: hg19Assembly,
    defaultSession: hg19DefaultSession,
    tracks: hg19Tracks,
  })
  return (
    <div>
      <JBrowseCircularGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/stories/examples/Human.tsx">
        Source code
      </a>
    </div>
  )
}
