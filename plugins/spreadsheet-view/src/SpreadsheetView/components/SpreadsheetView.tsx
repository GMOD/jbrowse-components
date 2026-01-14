import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import SpreadsheetViewActual from './SpreadsheetViewActual.tsx'

import type { SpreadsheetViewModel } from '../SpreadsheetViewModel.ts'

const ImportWizard = lazy(() => import('./ImportWizard.tsx'))

const SpreadsheetContainer = observer(function SpreadsheetContainer({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  return !model.spreadsheet?.initialized ? (
    <Suspense fallback={null}>
      <ImportWizard model={model.importWizard} />
    </Suspense>
  ) : (
    <SpreadsheetViewActual model={model} />
  )
})

export default SpreadsheetContainer
