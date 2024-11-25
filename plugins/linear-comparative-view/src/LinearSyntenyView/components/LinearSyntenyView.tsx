import React, { lazy } from 'react'
import { observer } from 'mobx-react'

// locals
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import type { LinearSyntenyViewModel } from '../model'

const LinearSyntenyImportForm = lazy(
  () => import('./ImportForm/LinearSyntenyImportForm'),
)

type LSV = LinearSyntenyViewModel

const LinearSyntenyView = observer(function ({ model }: { model: LSV }) {
  return !model.initialized ? (
    <LinearSyntenyImportForm model={model} />
  ) : (
    <LinearComparativeViewComponent model={model} />
  )
})

export default LinearSyntenyView
