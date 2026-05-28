/**
 * Advanced declarative initialization
 *
 * Exercises the full `init` surface in a single declarative snapshot:
 * - object-form `tracks` entries carrying a `displaySnapshot` (height override)
 * - `tracklist: true` to open the track selector on load
 * - `nav` to keep the navigation bar visible
 * - `highlight` to paint a region on first paint
 *
 * This mirrors the session-spec "advanced track configuration" documented for
 * JBrowse Web URL params, but expressed through the embedded component's
 * `defaultSession.view.init`.
 */

import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

import type { ViewModel } from '../../src/index.ts'

const refseqTrackId =
  'GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff'

const ViewWithErrorHandling = observer(function ViewWithErrorHandling({
  state,
}: {
  state: ViewModel
}) {
  const error = state.session.view.error
  if (error) {
    return <ErrorBanner error={error} />
  }
  return <JBrowseLinearGenomeView viewState={state} />
})

export const WithInitAdvanced = () => {
  const assembly = {
    name: 'hg38',
    aliases: ['GRCh38'],
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'P6R5xbRqRr',
      adapter: {
        type: 'BgzipFastaAdapter',
        fastaLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        },
        faiLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
        },
        gziLocation: {
          uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
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
      type: 'FeatureTrack',
      trackId: refseqTrackId,
      name: 'NCBI RefSeq Genes',
      category: ['Genes'],
      assemblyNames: ['hg38'],
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
  ]

  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Advanced init',
        view: {
          type: 'LinearGenomeView',
          init: {
            loc: 'chr1:11,106,077-11,261,675',
            assembly: 'hg38',
            tracklist: true,
            nav: true,
            tracks: [
              {
                trackId: refseqTrackId,
                displaySnapshot: { height: 200 },
              },
            ],
            highlight: ['chr1:11,170,000-11,190,000'],
          },
        },
      },
    }),
  )
  return (
    <div>
      <ViewWithErrorHandling state={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInitAdvanced.tsx">
        Source code
      </a>
    </div>
  )
}
