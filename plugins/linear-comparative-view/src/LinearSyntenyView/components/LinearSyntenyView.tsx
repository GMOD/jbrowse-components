import React, { lazy } from 'react'
import { observer } from 'mobx-react'

// locals
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'

const ImportForm = lazy(() => import('./ImportForm'))

type LSV = LinearSyntenyViewModel

const LinearSyntenyView = observer(({ model }: { model: LSV }) => {
  return !model.initialized ? (
    <ImportForm model={model} />
  ) : (
    <LinearComparativeViewComponent model={model} />
  )
})

export default LinearSyntenyView
