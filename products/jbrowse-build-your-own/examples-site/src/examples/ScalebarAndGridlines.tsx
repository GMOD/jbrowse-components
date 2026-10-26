import { useState } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  EmbedProvider,
  Gridlines,
  RegionSeams,
  Scalebar,
  TrackStack,
  useRubberband,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/react-linear-genome-view2'

const PointerGuide = observer(function PointerGuide({
  view,
  x,
}: {
  view: LinearGenomeViewModel
  x: number
}) {
  const palette = usePalette()
  const { refName, coord, oob } = view.pxToBp(x)
  return oob ? null : (
    <div
      data-testid="pointer-guide"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 4,
        pointerEvents: 'none',
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 1,
          background: palette.text.primary,
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: Math.min(Math.max(-x, -60), view.width - x - 120),
          width: 120,
          textAlign: 'center',
          fontSize: '0.7rem',
          lineHeight: '16px',
          whiteSpace: 'nowrap',
          color: palette.text.primary,
          background: palette.background.paper,
          boxShadow: `0 0 0 1px ${palette.divider}`,
        }}
      >
        {refName}:{coord.toLocaleString('en-US')}
      </span>
    </div>
  )
})

const Demo = observer(function Demo({ view }: { view: LinearGenomeViewModel }) {
  const palette = usePalette()
  const { range, props } = useRubberband(view)
  const [pointerX, setPointerX] = useState<number>()
  return (
    <div
      onPointerMove={event => {
        setPointerX(
          event.clientX - event.currentTarget.getBoundingClientRect().left,
        )
      }}
      onPointerLeave={() => {
        setPointerX(undefined)
      }}
    >
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
        ) : pointerX === undefined ? null : (
          <PointerGuide view={view} x={pointerX} />
        )}
      </TrackStack>
    </div>
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
    },
    tracks: [
      {
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: {
          height: 100,
          encoding: { color: { value: '#3a7ca5' } },
        },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
    ],
    configuration: { preferences: { scrollZoom: true } },
    view: {
      loc: 'chr17:43,044,295..43,060,000 chr17:43,100,000..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes'],
    },
  })
  if (!state) {
    return null
  }
  return (
    <EmbedProvider session={state.session}>
      <Demo view={state.session.view} />
    </EmbedProvider>
  )
})

export default ScalebarAndGridlines
