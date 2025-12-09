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
  const { initialized, views, loadingMessage } = model

  // Show loading if views exist but not yet initialized (e.g., share link
  // waiting for assemblies to load)
  if (!initialized && views.length > 0) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (!initialized) {
    return <LinearSyntenyImportForm model={model} />
  } else {
    return <LinearComparativeViewComponent model={model} />
  }
})

export default LinearSyntenyView
