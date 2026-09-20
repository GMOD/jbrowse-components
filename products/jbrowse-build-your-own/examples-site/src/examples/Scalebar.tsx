import { useRef, useState } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { usePointerDrag } from '@jbrowse/core/util/usePointerDrag'
import {
  EmbedProvider,
  RegionSeams,
  Scalebar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const Gridlines = observer(function Gridlines({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const palette = usePalette()
  const path = (major: boolean) =>
    view.gridlineTicks
      .filter(tick => tick.major === major)
      .map(tick => `M${tick.x + 0.5} 0V100000`)
      .join('')
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: view.staticBlocks.totalWidthPx,
        transform: `translateX(${view.staticBlocksTranslateX}px)`,
        pointerEvents: 'none',
      }}
    >
      <path d={path(false)} style={{ stroke: palette.gridlineMinor }} />
      <path d={path(true)} style={{ stroke: palette.gridlineMajor }} />
    </svg>
  )
})

function useDragToZoom(view: LinearGenomeViewModel) {
  const [range, setRange] = useState<{ left: number; right: number }>()
  const start = useRef({ anchor: 0, origin: 0 })
  const span = (clientX: number) => {
    const { anchor, origin } = start.current
    const x = Math.min(Math.max(clientX - origin, 0), view.width)
    return { left: Math.min(anchor, x), right: Math.max(anchor, x) }
  }
  const props = usePointerDrag({
    onDragStart(event) {
      const origin = event.currentTarget.getBoundingClientRect().left
      start.current = { anchor: event.clientX - origin, origin }
    },
    onDrag(event) {
      setRange(span(event.clientX))
    },
    onDragEnd(event) {
      const { left, right } = span(event.clientX)
      setRange(undefined)
      if (right - left >= 4) {
        view.moveTo(view.pxToBp(left), view.pxToBp(right))
      }
    },
  })
  return { range, props }
}

const Demo = observer(function Demo({ view }: { view: LinearGenomeViewModel }) {
  const palette = usePalette()
  const { range, props } = useDragToZoom(view)
  return (
    <TrackStack view={view}>
      <Gridlines view={view} />
      <Scalebar
        view={view}
        data-testid="scalebar"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        {...props}
      />
      <RegionSeams view={view} />
      {range ? (
        <div
          data-testid="rubberband"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: range.left,
            width: range.right - range.left,
            zIndex: 4,
            pointerEvents: 'none',
            background: `color-mix(in srgb, ${palette.primary.main} 20%, transparent)`,
          }}
        />
      ) : null}
    </TrackStack>
  )
})

const ScalebarAndGridlines = observer(function ScalebarAndGridlines() {
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
    ],
    init: {
      loc: 'chr17:43,044,295..43,060,000 chr17:43,100,000..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes'],
    },
  })
  return state ? (
    <EmbedProvider session={state.session}>
      <Demo view={state.session.view} />
    </EmbedProvider>
  ) : null
})

export default ScalebarAndGridlines
