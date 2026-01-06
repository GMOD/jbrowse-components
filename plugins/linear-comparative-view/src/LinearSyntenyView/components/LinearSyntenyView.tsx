import { lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'

const LinearSyntenyImportForm = lazy(
  () => import('./ImportForm/LinearSyntenyImportForm.tsx'),
)

const LinearSyntenyView = observer(function LinearSyntenyView({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { showLoading, showImportForm, loadingMessage } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (showImportForm) {
    return <LinearSyntenyImportForm model={model} />
  } else {
    return <LinearComparativeViewComponent model={model} />
  }
})

export default LinearSyntenyView
