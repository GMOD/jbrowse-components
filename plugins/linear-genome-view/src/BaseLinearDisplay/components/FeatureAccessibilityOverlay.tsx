import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { BlockModel } from '../models/serverSideRenderedBlock'
import type { Feature } from '@jbrowse/core/util'

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
    '&:focus': {
      outline: '2px solid #005fcc',
      outlineOffset: -2,
    },
  },
})

interface Props {
  blockState: BlockModel
  onFeatureClick?: (featureId: string, feature?: Feature) => void
  onFeatureContextMenu?: (featureId: string, feature?: Feature) => void
  onFeatureFocus?: (featureId: string, feature?: Feature) => void
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

        if (width < 1 || height < 1) {
          return null
        }

        // Get the actual Feature object from the layout (stored via addRect's data param)
        const feature = layout.getDataByID?.(featureId) as Feature | undefined

        // Build aria-label from feature or serializable data
        const name = feature?.get?.('name') || data?.label || featureId
        const type = feature?.get?.('type') || 'feature'
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
              onFeatureClick?.(featureId, feature)
            }}
            onContextMenu={e => {
              e.preventDefault()
              e.stopPropagation()
              onFeatureContextMenu?.(featureId, feature)
            }}
            onFocus={() => {
              onFeatureFocus?.(featureId, feature)
            }}
          />
        )
      })}
    </div>
  )
})

export default FeatureAccessibilityOverlay
