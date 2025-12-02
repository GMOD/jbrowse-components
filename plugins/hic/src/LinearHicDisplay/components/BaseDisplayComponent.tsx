import React, { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BlockErrorMessage = lazy(() => import('./BlockErrorMessage'))

interface BaseDisplayModel {
  error?: unknown
  regionTooLarge?: boolean
  reload: () => void
  regionCannotBeRendered: () => React.ReactElement | null
  drawn: boolean
  loading: boolean
  lastDrawnOffsetPx?: number
  message?: string
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

const BaseDisplayComponent = observer(function ({
  model,
  children,
}: {
  model: BaseDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <Suspense fallback={null}>
      <BlockErrorMessage model={model} />
    </Suspense>
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

const DataDisplay = observer(function ({
  model,
  children,
}: {
  model: BaseDisplayModel
  children?: React.ReactNode
}) {
  const { drawn, loading } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const left = (model.lastDrawnOffsetPx || 0) - view.offsetPx
  return (
    <div data-testid={`drawn-${drawn}`}>
      <div style={{ position: 'absolute', left }}>{children}</div>
      {left !== 0 || loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function ({ model }: { model: BaseDisplayModel }) {
  const { classes } = useStyles()
  const { message } = model
  return (
    <div className={classes.loading}>
      <div className={classes.loadingMessage}>
        <LoadingEllipses message={message} />
      </div>
    </div>
  )
})

export default BaseDisplayComponent
