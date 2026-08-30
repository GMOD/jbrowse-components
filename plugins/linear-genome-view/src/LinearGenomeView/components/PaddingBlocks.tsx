import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ZoomTransform from './ZoomTransform.tsx'
import { elidedBlockStyles } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  absoluteFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  block: {
    position: 'absolute',
    height: '100%',
  },
  boundaryBlock: {
    background: theme.palette.action.disabledBackground,
  },
  regionSeparator: {
    // opaque (not text.disabled, which is translucent): regions are now laid
    // out contiguously so the separator paints directly over track data on both
    // sides. A translucent fill would tint the data instead of masking it, and
    // would darken unevenly where the container-level and per-track
    // PaddingBlocks overlap. An opaque grey masks cleanly and stays seamless.
    background:
      theme.palette.mode === 'dark'
        ? theme.palette.grey[500]
        : theme.palette.grey[600],
  },
  elided: {
    ...elidedBlockStyles,
  },
}))

// Inter-region padding, elided, and boundary blocks plus region separators.
// In TracksContainer: renders before children (masks gridlines in inter-track
// margins at inter-region positions; TrackContainers paint on top).
// In TrackContainer: renders after TrackRenderingContainer within the Paper
// stacking context, masking the track canvas at inter-region positions while
// TrackLabel (zIndex:200) remains above it.
const PaddingBlocks = observer(function PaddingBlocks({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  // the geometry is `model.paddingSpans` -- shared with any host drawing this
  // itself, so a seam here and a seam in an embedder's own chrome can't be
  // computed two different ways. This file owns only what the spans look like.
  const spans = model.paddingSpans

  // Nothing to mask, so no positioned container to hold it — the common case,
  // since a view sitting inside one contig has no seam, elision or boundary.
  // The wrapper is not free: `ZoomTransform` reads `staticBlocks`, so an empty
  // one still re-rendered and rewrote its transform on every gesture frame, per
  // track. The view returns one shared array here, so this bails without even
  // re-rendering.
  if (spans.length === 0) {
    return null
  }

  const kindClass = {
    seam: classes.regionSeparator,
    elided: classes.elided,
    boundary: classes.boundaryBlock,
  }

  return (
    <ZoomTransform model={model} offset={offset}>
      <div className={classes.absoluteFill}>
        {/* Keyed by POSITION, not by the span's `key` (its block identity), so
        the list is a pool: a zoom moves every block, so every identity key
        changed and React rebuilt the whole list each frame, where positional
        keys patch the surviving nodes' transform and class instead. Same trade
        ScalebarCoordinateLabels documents, and it lands harder here — this
        component mounts once per track plus once for the container, so the
        churn was multiplied by the track count. */}
        {spans.map(({ x, width, kind }, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className={cx(classes.block, kindClass[kind])}
            style={{ transform: `translateX(${x}px)`, width }}
          />
        ))}
      </div>
    </ZoomTransform>
  )
})

export default PaddingBlocks
