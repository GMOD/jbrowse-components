import React from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

/**
 * Custom display component for HiC display that handles offset positioning
 * differently than the standard NonBlockCanvasDisplayComponent.
 *
 * The HiC display needs to position content at Math.max(0, -offsetPx) when
 * scrolled beyond the region start, without the smooth scrolling shift
 * that NonBlockCanvasDisplayComponent provides.
 */
export interface HicDisplayModel {
  error?: unknown
  regionTooLarge?: boolean
  reload: () => void
  regionCannotBeRendered: () => React.ReactElement | null
  drawn: boolean
  loading: boolean
  statusMessage?: string
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

const HicBaseDisplayComponent = observer(function HicBaseDisplayComponent({
  model,
  children,
}: {
  model: HicDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <ErrorMessage error={error} />
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

const DataDisplay = observer(function DataDisplay({
  model,
  children,
}: {
  model: HicDisplayModel
  children?: React.ReactNode
}) {
  const { drawn, loading } = model

  return (
    <div data-testid={`drawn-${drawn}`}>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function LoadingBar({
  model,
}: {
  model: HicDisplayModel
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

export default HicBaseDisplayComponent
