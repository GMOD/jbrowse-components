import {
  EmbedProvider,
  ResizeHandle,
  Track,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const labels = {
  hg38_phylop: 'Conservation',
  hg38_genes: 'Genes',
  na12878_exome: 'Reads',
}

const ids = Object.keys(labels) as (keyof typeof labels)[]

const BAR = 4

const Labels = observer(function Labels({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  return (
    <div style={{ width: 90, flex: 'none', fontSize: '0.75rem' }}>
      {ids.map(id => {
        const display = view.getTrack(id)?.activeDisplay
        return display ? (
          <div
            key={id}
            style={{
              height: display.height + BAR,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {labels[id]}
          </div>
        ) : null
      })}
    </div>
  )
})

const TrackLabels = observer(function TrackLabels() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
    tracks: [
      {
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 100, color: '#3a7ca5' },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
      {
        trackId: 'na12878_exome',
        name: 'NA12878 exome reads',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        displayDefaults: { height: 150 },
      },
    ],
    init: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ids,
    },
  })
  return state ? (
    <EmbedProvider session={state.session}>
      <div style={{ display: 'flex' }}>
        <Labels view={state.session.view} />
        <TrackStack
          view={state.session.view}
          trackIds={ids}
          style={{ flex: 1, minWidth: 0 }}
          renderTrack={id => (
            <>
              <Track view={state.session.view} trackId={id} />
              <ResizeHandle
                view={state.session.view}
                trackId={id}
                style={{ height: BAR }}
              />
            </>
          )}
        />
      </div>
    </EmbedProvider>
  ) : null
})

export default TrackLabels
