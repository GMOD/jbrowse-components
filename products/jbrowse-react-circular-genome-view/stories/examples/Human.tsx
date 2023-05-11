import React from 'react'

// replace with from '@jbrowse/react-circular-genome-view' in your code
import { createViewState, JBrowseCircularGenomeView } from '../../src'

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
        locationType: 'UriLocation',
      },
      faiLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.fai',
        locationType: 'UriLocation',
      },
      gziLocation: {
        uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz.gzi',
        locationType: 'UriLocation',
      },
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
        locationType: 'UriLocation',
      },
    },
  },
}

const hg19Tracks = [
  {
    type: 'VariantTrack',
    trackId: 'pacbio_sv_vcf',
    name: 'HG002 Pacbio SV (VCF)',
    assemblyNames: ['hg19'],
    category: ['GIAB'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    },
  },
]

const hg19DefaultSession = {
  name: 'this session',
  view: {
    id: 'circularView',
    type: 'CircularView',
    bpPerPx: 5000000,
    tracks: [
      {
        id: 'uPdLKHik1',
        type: 'VariantTrack',
        configuration: 'pacbio_sv_vcf',
        displays: [
          {
            id: 'v9QVAR3oaB',
            type: 'ChordVariantDisplay',
            configuration: 'pacbio_sv_vcf-ChordVariantDisplay',
          },
        ],
      },
    ],
  },
}

export const Human = () => {
  const state = createViewState({
    assembly: hg19Assembly,
    tracks: hg19Tracks,
    defaultSession: hg19DefaultSession,
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
