import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { calculateFloatingLabelPosition } from './util.ts'

import type { FeatureTrackModel } from '../../LinearBasicDisplay/model.ts'
import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'

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

interface FloatingLabelProps {
  text: string
  color: string
  isOverlay: boolean
  featureLeftPx: number
  featureRightPx: number
  featureId: string
  subfeatureId?: string
  labelWidth: number
  y: number
  offsetPx: number
  tooltip?: string
  labelClass: string
  overlayClass: string
}

// Floating labels need JS calculation to avoid CSS precision issues with large
// coordinates (calc(1000000px - var(--offset-px)) can jitter)
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
  tooltip,
  labelClass,
  overlayClass,
}: FloatingLabelProps) {
  const x = calculateFloatingLabelPosition(
    featureLeftPx,
    featureRightPx,
    labelWidth,
    offsetPx,
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

  // @ts-expect-error LinearFeatureDisplay's renderingProps override
  // adds these callbacks but TS view-chain inheritance loses them
  const { onFeatureClick, onFeatureContextMenu, onMouseMove } =
    model.renderingProps()

  const labels: React.ReactElement[] = []

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

      labels.push(
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
          tooltip={tooltip}
          labelClass={classes.label}
          overlayClass={classes.overlay}
        />,
      )
    }
  }

  return (
    <div
      className={classes.container}
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
      {labels}
    </div>
  )
})

export default FloatingLabels
