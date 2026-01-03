import { memo } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { calculateFloatingLabelPosition } from './util'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'

const useStyles = makeStyles()({
  // Full-size overlay container for floating labels
  // pointerEvents:none allows clicks to pass through to features beneath
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 5,
  },
  // Base label styles - positioned via transform for performance
  // pointerEvents:auto re-enables interaction on the labels themselves
  label: {
    position: 'absolute',
    fontSize: 11,
    cursor: 'default',
    pointerEvents: 'auto',
  },
  // Overlay labels get a semi-transparent background for readability
  overlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1,
  },
})

interface BaseLabelProps {
  text: string
  color: string
  isOverlay: boolean
  featureLeftPx: number
  featureId: string
  subfeatureId?: string
  y: number
  tooltip?: string
  labelClass: string
  overlayClass: string
}

interface FloatingLabelProps extends BaseLabelProps {
  featureRightPx: number
  labelWidth: number
  offsetPx: number
  viewportLeft: number
}

// Fixed labels use CSS variable for offset - position updates via CSS, not JS
// This avoids React re-renders during scroll for labels that don't float
const FixedLabel = memo(function FixedLabel({
  text,
  color,
  isOverlay,
  featureLeftPx,
  featureId,
  subfeatureId,
  y,
  tooltip,
  labelClass,
  overlayClass,
}: BaseLabelProps) {
  return (
    <div
      data-feature-id={featureId}
      data-subfeature-id={subfeatureId}
      data-tooltip={tooltip}
      className={isOverlay ? `${labelClass} ${overlayClass}` : labelClass}
      style={{
        color,
        transform: `translate(calc(${featureLeftPx}px - var(--offset-px)), ${y}px)`,
      }}
    >
      {text}
    </div>
  )
})

// Floating labels need JS calculation for the clamp logic
function FloatingLabel({
  text,
  color,
  isOverlay,
  featureLeftPx,
  featureRightPx,
  featureId,
  subfeatureId,
  labelWidth,
  y,
  offsetPx,
  viewportLeft,
  tooltip,
  labelClass,
  overlayClass,
}: FloatingLabelProps) {
  const x = calculateFloatingLabelPosition(
    featureLeftPx,
    featureRightPx,
    labelWidth,
    offsetPx,
    viewportLeft,
  )

  return (
    <div
      data-feature-id={featureId}
      data-subfeature-id={subfeatureId}
      data-tooltip={tooltip}
      className={isOverlay ? `${labelClass} ${overlayClass}` : labelClass}
      style={{ color, transform: `translate(${x}px,${y}px)` }}
    >
      {text}
    </div>
  )
}

const FloatingLabels = observer(function FloatingLabels({
  model,
}: {
  model: FeatureTrackModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LinearGenomeViewModel
  const { offsetPx } = view
  const featureLabels = model.floatingLabelData

  // @ts-expect-error
  const { onFeatureClick, onFeatureContextMenu, onMouseMove } =
    model.renderingProps()

  const fixedLabels: React.ReactElement[] = []
  const floatingLabels: React.ReactElement[] = []

  // Calculate viewport left edge once per render instead of per label
  const viewportLeft = Math.max(0, offsetPx)

  for (const [
    key,
    {
      leftPx,
      topPx,
      totalFeatureHeight,
      floatingLabels: labelData,
      featureWidth,
    },
  ] of featureLabels.entries()) {
    const featureVisualBottom = topPx + totalFeatureHeight
    const featureRightPx = leftPx + featureWidth

    for (let i = 0, l = labelData.length; i < l; i++) {
      const floatingLabel = labelData[i]!
      const {
        text,
        relativeY,
        color,
        isOverlay,
        textWidth: labelWidth,
        parentFeatureId,
        subfeatureId,
        tooltip,
      } = floatingLabel

      const y = featureVisualBottom + relativeY
      const labelKey = `${key}-${i}`
      const featureId = parentFeatureId ?? key

      // Labels wider than feature don't float - use CSS variable for offset
      // This avoids React re-renders during scroll
      if (labelWidth > featureWidth) {
        fixedLabels.push(
          <FixedLabel
            key={labelKey}
            text={text}
            color={color}
            isOverlay={isOverlay ?? false}
            featureLeftPx={leftPx}
            featureId={featureId}
            subfeatureId={subfeatureId}
            y={y}
            tooltip={tooltip}
            labelClass={classes.label}
            overlayClass={classes.overlay}
          />,
        )
      } else {
        // Labels that fit within feature need JS calculation for floating logic
        floatingLabels.push(
          <FloatingLabel
            key={labelKey}
            text={text}
            color={color}
            isOverlay={isOverlay ?? false}
            featureLeftPx={leftPx}
            featureRightPx={featureRightPx}
            featureId={featureId}
            subfeatureId={subfeatureId}
            labelWidth={labelWidth}
            y={y}
            offsetPx={offsetPx}
            viewportLeft={viewportLeft}
            tooltip={tooltip}
            labelClass={classes.label}
            overlayClass={classes.overlay}
          />,
        )
      }
    }
  }

  return (
    <div
      className={classes.container}
      style={{ '--offset-px': `${offsetPx}px` } as React.CSSProperties}
      onClick={e => {
        const target = e.target as HTMLElement
        const subfeatureId = target.dataset.subfeatureId
        const featureId = subfeatureId ?? target.dataset.featureId
        if (featureId) {
          onFeatureClick?.(e, featureId)
        }
      }}
      onContextMenu={e => {
        const target = e.target as HTMLElement
        const subfeatureId = target.dataset.subfeatureId
        const featureId = subfeatureId ?? target.dataset.featureId
        if (featureId) {
          onFeatureContextMenu?.(e, featureId)
        }
      }}
      onMouseOver={e => {
        const target = e.target as HTMLElement
        const featureId = target.dataset.featureId
        if (featureId) {
          const tooltip = target.dataset.tooltip
          const subfeatureId = target.dataset.subfeatureId
          onMouseMove?.(e, featureId, tooltip)
          model.setSubfeatureIdUnderMouse(subfeatureId)
        }
      }}
    >
      {fixedLabels}
      {floatingLabels}
    </div>
  )
})

export default FloatingLabels
