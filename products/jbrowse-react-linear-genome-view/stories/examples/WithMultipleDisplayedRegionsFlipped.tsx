// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { observer } from 'mobx-react'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

interface TranscriptFeature {
  refName: string
  subfeatures?: { type?: string; start: number; end: number }[]
} /**
 * Given a feature with subfeatures (e.g. a transcript with exons), returns a
 * displayedRegions array that shows only the exon/CDS intervals, omitting
 * introns. This is the programmatic equivalent of the built-in "Collapse
 * introns" right-click action available in the JBrowse UI.
 *
 * @param feature  - a serialized gene or transcript with subfeature exons/CDS
 * @param padding  - bp to pad each exon on both sides (default 50)
 */
function getExonRegionsFromFeature(feature: TranscriptFeature, padding = 50) {
  const subs = feature.subfeatures ?? []
  const exons = subs.filter(
    f => f.type === 'exon' || f.type === 'CDS' || !f.type,
  )
  const sorted = [...exons].sort((a, b) => a.start - b.start)
  const merged: { refName: string; start: number; end: number }[] = []
  for (const exon of sorted) {
    const paddedStart = Math.max(0, exon.start - padding)
    const paddedEnd = exon.end + padding
    const last = merged.at(-1)
    if (last && paddedStart <= last.end) {
      last.end = Math.max(last.end, paddedEnd)
    } else {
      merged.push({
        refName: feature.refName,
        start: paddedStart,
        end: paddedEnd,
      })
    }
  }
  return merged
}

/**
 * Converts a list of 0-based regions to a space-separated locstring suitable
 * for use with `init.loc` or `navToLocString`. Locstrings use 1-based coords.
 */
function regionsToLocString(
  regions: { refName: string; start: number; end: number }[],
) {
  return regions.map(r => `${r.refName}:${r.start + 1}..${r.end}`).join(' ')
}

// NM_001312686.1, a positive-strand gene on GRCh38 chr1 with 19 exons
const transcript = {
  strand: 1,
  refName: 'chr1',
  type: 'mRNA',
  start: 113073169,
  end: 113125202,
  subfeatures: [
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113073169,
      end: 113073645,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113091317,
      end: 113091383,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113092028,
      end: 113092140,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113093205,
      end: 113093280,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113093209,
      end: 113093280,
      phase: 0,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113093429,
      end: 113093564,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113093429,
      end: 113093564,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113094338,
      end: 113094482,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113094338,
      end: 113094482,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113094611,
      end: 113094755,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113094611,
      end: 113094755,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113095873,
      end: 113096017,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113095873,
      end: 113096017,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113096221,
      end: 113096365,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113096221,
      end: 113096365,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113098704,
      end: 113098785,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113098704,
      end: 113098785,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113100210,
      end: 113100282,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113100210,
      end: 113100282,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113100419,
      end: 113100488,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113100419,
      end: 113100488,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113107593,
      end: 113107757,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113107593,
      end: 113107757,
      phase: 1,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113110241,
      end: 113110562,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113110241,
      end: 113110562,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113112478,
      end: 113112760,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113112478,
      end: 113112760,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113114426,
      end: 113114876,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113114426,
      end: 113114876,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113116286,
      end: 113116436,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113116286,
      end: 113116436,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113119232,
      end: 113119523,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113119232,
      end: 113119523,
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'CDS',
      start: 113123874,
      end: 113124101,
      phase: 2,
      id: 'CDS5727',
      name: 'NP_001299615.1',
    },
    {
      strand: 1,
      refName: 'chr1',
      type: 'exon',
      start: 113123874,
      end: 113125202,
    },
  ],
  id: 'mRNA5901',
  name: 'NM_001312686.1',
}

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

const FlipView = observer(function FlipView({ state }: { state: ViewModel }) {
  const view = state.session.view
  const isFlipped = view.displayedRegions[0]?.reversed ?? false
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => {
            view.horizontallyFlip()
          }}
        >
          {isFlipped ? 'Unflip (show 5′→3′)' : 'Flip horizontally (show 3′→5′)'}
        </button>
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
})

export const WithMultipleDisplayedRegionsFlipped = () => {
  const [state] = useState(() => {
    const loc = regionsToLocString(getExonRegionsFromFeature(transcript))
    return createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Multi-region flipped example',
        view: {
          id: 'multi_region_flipped_view',
          type: 'LinearGenomeView',
          init: {
            loc,
            assembly: 'GRCh38',
            tracks: [
              'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff',
              'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
            ],
          },
        },
      },
    })
  })

  return (
    <div>
      <FlipView state={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithMultipleDisplayedRegionsFlipped.tsx">
        Source code
      </a>
    </div>
  )
}
