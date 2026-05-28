// replace with from '@jbrowse/react-circular-genome-view2' in your code
import { useState } from 'react'

import { JBrowseCircularGenomeView, createViewState } from '../../src/index.ts'

const hg19Assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'Pd8Wh30ei9R',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
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
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/pacbio/hs37d5.HG002-SequelII-CCS.bnd-only.sv.vcf.gz',
    },
  },
]

export const Human = () => {
  const [state] = useState(() =>
    createViewState({
      assembly: hg19Assembly,
      tracks: hg19Tracks,
      defaultSession: {
        name: 'this session',
        view: {
          id: 'circularView',
          type: 'CircularView',
          init: {
            assembly: 'hg19',
            tracks: ['pacbio_sv_vcf'],
          },
        },
      },
    }),
  )
  return (
    <div>
      <JBrowseCircularGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/stories/examples/Human.tsx">
        Source code
      </a>
    </div>
  )
}
