import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import ErrorActions from './ErrorActions.tsx'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

const ArcErrorDisplay = observer(function ArcErrorDisplay({
  model,
}: {
  model: ArcDisplayModel
}) {
  const { error } = model
  return (
    <BlockMsg
      message={`${error}`}
      severity="error"
      action={<ErrorActions model={model} />}
    />
  )
})

export default ArcErrorDisplay
