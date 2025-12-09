import { lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
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
  const { initialized, showLoading, loadingMessage } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (!initialized) {
    return <LinearSyntenyImportForm model={model} />
  } else {
    return <LinearComparativeViewComponent model={model} />
  }
})

export default LinearSyntenyView
