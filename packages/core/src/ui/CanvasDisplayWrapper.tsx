import React from 'react'

import { observer } from 'mobx-react'

import ErrorMessage from './ErrorMessage.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import { makeStyles } from '../util/tss-react/index.ts'

export interface CanvasDisplayModel {
  error?: unknown
  regionTooLarge?: boolean
  regionCannotBeRendered: () => React.ReactElement | null
  isLoading: boolean
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

const LoadingBar = observer(function LoadingBar({
  model,
}: {
  model: CanvasDisplayModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.loading}>
      <div className={classes.loadingMessage}>
        <LoadingEllipses message={model.statusMessage} />
      </div>
    </div>
  )
})

const DataDisplay = observer(function DataDisplay({
  model,
  children,
}: {
  model: CanvasDisplayModel
  children?: React.ReactNode
}) {
  return (
    <div>
      {children}
      {model.isLoading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const CanvasDisplayWrapper = observer(function CanvasDisplayWrapper({
  model,
  children,
}: {
  model: CanvasDisplayModel
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

export default CanvasDisplayWrapper
