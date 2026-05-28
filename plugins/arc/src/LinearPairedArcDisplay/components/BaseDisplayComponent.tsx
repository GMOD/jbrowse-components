import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LoadingBar from './LoadingBar.tsx'

import type { LinearArcDisplayModel } from '../model.ts'

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
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { error, regionTooLarge, loading } = model
  return error ? (
    <Suspense fallback={null}>
      <ArcErrorDisplay model={model} />
    </Suspense>
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <div className={classes.container}>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

export default BaseDisplayComponent
