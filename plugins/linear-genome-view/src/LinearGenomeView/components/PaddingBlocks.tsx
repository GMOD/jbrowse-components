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
  const { staticBlocks } = model
  const blocks = staticBlocks.blocks
  const firstBlockOffset = blocks[0]?.offsetPx ?? 0

  return (
    <ZoomTransform model={model} offset={offset}>
      <div className={classes.absoluteFill}>
        {blocks.map(block => {
          if (block.type === 'ContentBlock') {
            return block.isRightEndOfDisplayedRegion ? (
              <div
                key={`${block.key}-sep`}
                className={cx(classes.block, classes.regionSeparator)}
                style={{
                  transform: `translateX(${block.offsetPx - firstBlockOffset + block.widthPx - 1}px)`,
                  width: 3,
                }}
              />
            ) : null
          }
          const bgClass =
            block.type === 'ElidedBlock'
              ? classes.elided
              : classes.boundaryBlock
          return (
            <div
              key={block.key}
              className={cx(classes.block, bgClass)}
              style={{
                transform: `translateX(${block.offsetPx - firstBlockOffset}px)`,
                width: block.widthPx,
              }}
            />
          )
        })}
      </div>
    </ZoomTransform>
  )
})

export default PaddingBlocks
