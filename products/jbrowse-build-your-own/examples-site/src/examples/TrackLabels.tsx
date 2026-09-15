import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { usePanZoom } from '@jbrowse/core/util/usePanZoom'
import { useResizeDrag } from '@jbrowse/core/util/useResizeDrag'
import { DisplayUIProvider } from '@jbrowse/display-ui'
import { Track, ViewStatus } from '@jbrowse/display-ui/embed'
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

const ResizeBar = observer(function ResizeBar({
  view,
  trackId,
}: {
  view: LinearGenomeViewModel
  trackId: string
}) {
  const display = view.getTrack(trackId)?.activeDisplay
  const props = useResizeDrag({
    onDragStart: () => {
      display?.setResizing(true)
    },
    onDrag: distance => {
      display?.resizeHeight(distance)
    },
    onDragEnd: () => {
      display?.setResizing(false)
    },
  })
  return (
    <div
      {...props}
      aria-label={`Resize ${trackId}`}
      style={{
        height: BAR,
        cursor: 'row-resize',
        touchAction: 'none',
        background: 'color-mix(in srgb, currentColor 20%, transparent)',
      }}
    />
  )
})

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

const Tracks = observer(function Tracks({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const ref = useWidthSetter(view)
  const { containerProps } = usePanZoom(ref, view)
  return (
    <div
      ref={ref}
      {...containerProps}
      style={{ position: 'relative', overflow: 'hidden', flex: 1, minWidth: 0 }}
    >
      {view.status.type === 'ready' ? (
        ids.map(id => (
          <div key={id}>
            <Track view={view} trackId={id} />
            <ResizeBar view={view} trackId={id} />
          </div>
        ))
      ) : (
        <ViewStatus view={view} />
      )}
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
    },
    tracks: [
      {
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
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
    <SessionPaletteProvider session={state.session}>
      <DisplayUIProvider>
        <div style={{ display: 'flex' }}>
          <Labels view={state.session.view} />
          <Tracks view={state.session.view} />
        </div>
      </DisplayUIProvider>
    </SessionPaletteProvider>
  ) : null
})

export default TrackLabels
