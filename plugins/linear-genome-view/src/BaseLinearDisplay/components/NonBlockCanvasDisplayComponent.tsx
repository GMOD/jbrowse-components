import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import BlockErrorMessage from './BlockErrorMessage'
import FloatingLegend from './FloatingLegend'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { LegendItem } from '../model'

/**
 * Interface for models that can be rendered with NonBlockCanvasDisplayComponent.
 * These are displays that render to a single canvas across the view width
 * rather than using block-based rendering.
 */
export interface NonBlockCanvasDisplayModel {
  error?: unknown
  regionTooLarge?: boolean
  reload: () => void
  regionCannotBeRendered: () => React.ReactElement | null
  drawn: boolean
  loading: boolean
  lastDrawnOffsetPx?: number
  statusMessage?: string
  showLegend?: boolean
  legendItems?: () => LegendItem[]
}

const useStyles = makeStyles()({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)`,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingMessage: {
    zIndex: 2,
    pointerEvents: 'none',
  },
})

/**
 * Component that handles the display container for non-block-based canvas displays.
 *
 * This component:
 * - Shows error messages when the display has an error
 * - Shows region-too-large message when appropriate
 * - Handles the offset positioning during scrolling (shifts the canvas using
 *   lastDrawnOffsetPx - view.offsetPx to provide smooth scrolling before re-render)
 * - Shows loading indicator when data is being fetched or the view has scrolled
 */
const NonBlockCanvasDisplayComponent = observer(
  function NonBlockCanvasDisplayComponent({
    model,
    children,
  }: {
    model: NonBlockCanvasDisplayModel
    children?: React.ReactNode
  }) {
    const { error, regionTooLarge } = model
    return error ? (
      <BlockErrorMessage model={model} />
    ) : regionTooLarge ? (
      model.regionCannotBeRendered()
    ) : (
      <DataDisplay model={model}>{children}</DataDisplay>
    )
  },
)

const DataDisplay = observer(function DataDisplay({
  model,
  children,
}: {
  model: NonBlockCanvasDisplayModel
  children?: React.ReactNode
}) {
  const { drawn, loading, showLegend, legendItems } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const items = legendItems?.() ?? []

  // Calculate how much to shift the rendered canvas to account for scrolling.
  // When the user scrolls, view.offsetPx changes but the canvas content
  // stays the same until a new render completes. This shift keeps the
  // content aligned during that time.
  const calculatedLeft = (model.lastDrawnOffsetPx ?? 0) - view.offsetPx

  return (
    // this data-testid is located here because changing props on the canvas
    // itself is very sensitive to triggering ref invalidation
    <div data-testid={`drawn-${drawn}`}>
      <div
        style={{
          position: 'absolute',
          left: calculatedLeft,
        }}
      >
        {children}
      </div>
      {showLegend && items.length > 0 ? <FloatingLegend items={items} /> : null}
      {calculatedLeft !== 0 || loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function LoadingBar({
  model,
}: {
  model: NonBlockCanvasDisplayModel
}) {
  const { classes } = useStyles()
  const { statusMessage } = model
  return (
    <div className={classes.loading}>
      <div className={classes.loadingMessage}>
        <LoadingEllipses message={statusMessage} />
      </div>
    </div>
  )
})

export default NonBlockCanvasDisplayComponent
