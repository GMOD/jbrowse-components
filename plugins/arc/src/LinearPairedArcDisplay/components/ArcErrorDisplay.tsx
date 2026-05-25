import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import ErrorActions from './ErrorActions.tsx'

import type { LinearArcDisplayModel } from '../model.ts'

const ArcErrorDisplay = observer(function ArcErrorDisplay({
  model,
}: {
  model: LinearArcDisplayModel
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
