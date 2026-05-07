import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import LoadingBar from './LoadingBar.tsx'

import type { LinearArcDisplayModel } from '../model.ts'

const ArcErrorDisplay = lazy(() => import('./ArcErrorDisplay.tsx'))

const BaseDisplayComponent = observer(function BaseDisplayComponent({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge, loading } = model
  return error ? (
    <Suspense fallback={null}>
      <ArcErrorDisplay model={model} />
    </Suspense>
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <div>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

export default BaseDisplayComponent
