import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import LoadingBar from './LoadingBar'

import type { LinearArcDisplayModel } from '../model'

const ErrorMessage = lazy(() => import('./ErrorMessage'))

const BaseDisplayComponent = observer(function BaseDisplayComponent({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <Suspense fallback={null}>
      <ErrorMessage model={model} />
    </Suspense>
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
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { loading } = model
  return (
    <div>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

export default BaseDisplayComponent
