/**
 * Declarative alignments display config
 *
 * Opens a CRAM alignments track via `init` with a `displaySnapshot` that
 * configures the display declaratively at first paint:
 * - `colorBySetting` to color reads by pair orientation
 * - `showSoftClipping` to reveal soft-clipped bases
 * - `height` to give the track more vertical room
 *
 * This is the alignments-track analogue of the session-spec advanced track
 * configuration in the JBrowse Web URL params docs, expressed through the
 * embedded component's `defaultSession.view.init`.
 */

import { useState } from 'react'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const cramTrackId = 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'

const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
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
    type: 'AlignmentsTrack',
    trackId: cramTrackId,
    name: 'NA12878 Exome',
    category: ['1000 Genomes', 'Alignments'],
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
      },
      craiLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram.crai',
      },
      // CRAM decoding requires a copy of the assembly's sequence adapter so
      // the worker can reconstruct read bases against the reference
      sequenceAdapter: {
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
  },
]

export const WithInitAlignmentsDisplay = () => {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Alignments display config',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: '1:100,987,200..100,987,450',
            assembly: 'GRCh38',
            tracks: [
              {
                trackId: cramTrackId,
                displaySnapshot: {
                  type: 'LinearAlignmentsDisplay',
                  height: 250,
                  showSoftClipping: true,
                  colorBySetting: { type: 'pairOrientation' },
                },
              },
            ],
          },
        },
      },
    }),
  )

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInitAlignmentsDisplay.tsx">
        Source code
      </a>
    </div>
  )
}
