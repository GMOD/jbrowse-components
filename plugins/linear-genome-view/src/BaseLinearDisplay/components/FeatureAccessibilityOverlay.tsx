import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { BlockModel } from '../models/serverSideRenderedBlock'

const useStyles = makeStyles()({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  featureButton: {
    position: 'absolute',
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    pointerEvents: 'auto',
    // Visually hidden but accessible
    '&:focus': {
      outline: '2px solid #005fcc',
      outlineOffset: -2,
    },
  },
})

interface Props {
  blockState: BlockModel
  onFeatureClick?: (featureId: string) => void
  onFeatureContextMenu?: (featureId: string) => void
  onFeatureFocus?: (featureId: string) => void
}

const FeatureAccessibilityOverlay = observer(function FeatureAccessibilityOverlay({
  blockState,
  onFeatureClick,
  onFeatureContextMenu,
  onFeatureFocus,
}: Props) {
  const { classes } = useStyles()
  const { layout } = blockState

  if (!layout) {
    return null
  }

  // Get all rectangles from the layout
  // getRectangles returns Map<string, [left, top, right, bottom, serializableData]>
  const rectangles = layout.getRectangles?.()
  if (!rectangles) {
    return null
  }

  return (
    <div className={classes.overlay} aria-label="Feature overlay">
      {[...rectangles.entries()].map(([featureId, rect]) => {
        const [left, top, right, bottom, data] = rect
        const width = right - left
        const height = bottom - top

        // Skip very small features that would be hard to interact with
        if (width < 1 || height < 1) {
          return null
        }

        // Build aria-label from available data
        const name = data?.name || data?.id || featureId
        const type = data?.type || 'feature'
        const ariaLabel = `${name}, ${type}`

        return (
          <button
            key={featureId}
            className={classes.featureButton}
            data-testid={`feature-${featureId}`}
            data-feature-id={featureId}
            aria-label={ariaLabel}
            style={{
              left,
              top,
              width,
              height,
            }}
            tabIndex={0}
            onClick={e => {
              e.stopPropagation()
              onFeatureClick?.(featureId)
            }}
            onContextMenu={e => {
              e.preventDefault()
              e.stopPropagation()
              onFeatureContextMenu?.(featureId)
            }}
            onFocus={() => {
              onFeatureFocus?.(featureId)
            }}
          />
        )
      })}
    </div>
  )
})

export default FeatureAccessibilityOverlay
