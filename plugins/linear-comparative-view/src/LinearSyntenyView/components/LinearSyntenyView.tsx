import { lazy } from 'react'

import { observer } from 'mobx-react'

import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'

import type { LinearSyntenyViewModel } from '../model'

const LinearSyntenyImportForm = lazy(
  () => import('./ImportForm/LinearSyntenyImportForm'),
)

const LinearSyntenyView = observer(function ({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  return !model.initialized ? (
    <LinearSyntenyImportForm model={model} />
  ) : (
    <LinearComparativeViewComponent model={model} />
  )
})

export default LinearSyntenyView
