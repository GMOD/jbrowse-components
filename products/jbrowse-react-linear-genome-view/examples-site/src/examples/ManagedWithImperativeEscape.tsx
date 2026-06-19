import { useRef } from 'react'

import {
  LinearGenomeView,
  type ViewModel,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
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
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
      index: {
        location: {
          uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
        },
        indexType: 'CSI',
      },
    },
  },
]

const bookmarks = [
  { label: 'region A', loc: 'chr1:11,106,077-11,261,675' },
  { label: 'region B', loc: 'chr2:20,000..25,000' },
]

// a ref to the live engine lets external buttons navigate the view, without
// the parent ever calling createViewState
export default function ManagedWithImperativeEscape() {
  const ref = useRef<ViewModel>(null)
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              ref.current?.session.view
                .navToLocString(b.loc)
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={tracks}
        init={{ loc: 'chr1:11,106,077-11,261,675' }}
      />
    </div>
  )
}
