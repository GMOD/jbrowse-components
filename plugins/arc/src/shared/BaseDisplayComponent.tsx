import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LoadingBar from './LoadingBar.tsx'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

const ArcErrorDisplay = lazy(() => import('./ArcErrorDisplay.tsx'))

const useStyles = makeStyles()({
  container: {
    position: 'relative',
  },
})

const BaseDisplayComponent = observer(function BaseDisplayComponent({
  model,
  children,
}: {
  model: ArcDisplayModel
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { error, regionTooLarge, loading, fetchSettled } = model
  return error ? (
    <Suspense fallback={null}>
      <ArcErrorDisplay model={model} />
    </Suspense>
  ) : regionTooLarge ? (
    <TooLargeMessage model={model} />
  ) : (
    <div
      className={classes.container}
      data-testid={fetchSettled ? 'arc-display-done' : 'arc-display'}
    >
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

export default BaseDisplayComponent
