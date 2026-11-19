import { zoomLinkColor } from '@jbrowse/core/ui/palette'
import { trapezoidPoints } from '@jbrowse/core/util/Base1DUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { AbstractViewModel } from '@jbrowse/core/util'
import type { PxSpan } from '@jbrowse/core/util/Base1DUtils'

export const ZOOM_CONNECTOR_HEIGHT = 40

interface ZoomLinkedView {
  zoomOf?: string
  zoomConnector?: { top: PxSpan; bottom: PxSpan }
}

function isZoomLinked(
  view: AbstractViewModel,
): view is AbstractViewModel & ZoomLinkedView {
  return 'zoomOf' in view && 'zoomConnector' in view
}

export function zoomConnectorBetween(
  upper: AbstractViewModel,
  lower: AbstractViewModel,
) {
  const down =
    isZoomLinked(lower) && lower.zoomOf === upper.id
      ? lower.zoomConnector
      : undefined
  const up =
    isZoomLinked(upper) && upper.zoomOf === lower.id
      ? upper.zoomConnector
      : undefined
  return down ?? (up ? { top: up.bottom, bottom: up.top } : undefined)
}

const useStyles = makeStyles()(theme => ({
  connector: {
    display: 'block',
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
    // over the upper view's bottom padding, so the top edge meets its tracks,
    // and flush with the lower view's top edge; ViewContainer's margin and
    // padding
    marginTop: `calc(-1 * (${theme.spacing(0.5)} + ${theme.spacing(1)}))`,
    marginBottom: `calc(-1 * ${theme.spacing(0.5)})`,
    pointerEvents: 'none',
  },
  polygon: {
    fill: zoomLinkColor(theme.palette.tertiary.light),
    stroke: theme.palette.tertiary.light,
    strokeWidth: 1,
  },
}))

const ZoomConnector = observer(function ZoomConnector({
  upper,
  lower,
}: {
  upper: AbstractViewModel
  lower: AbstractViewModel
}) {
  const { classes, theme } = useStyles()
  const connector = zoomConnectorBetween(upper, lower)
  const padding = Number.parseFloat(theme.spacing(1))
  const height = ZOOM_CONNECTOR_HEIGHT + padding
  const inset = Number.parseFloat(theme.spacing(0.5)) + padding
  const shift = (span: PxSpan) => ({
    leftPx: span.leftPx + inset,
    rightPx: span.rightPx + inset,
  })
  return connector ? (
    <svg
      data-testid={`zoom-connector-${upper.id}-${lower.id}`}
      width="100%"
      height={height}
      className={classes.connector}
    >
      <polygon
        points={trapezoidPoints(
          shift(connector.top),
          shift(connector.bottom),
          height,
        )}
        className={classes.polygon}
      />
    </svg>
  ) : null
})

export default ZoomConnector
