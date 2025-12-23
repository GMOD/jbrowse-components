import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import ErrorActions from './ErrorActions'

import type { LinearArcDisplayModel } from '../model'

const ErrorMessage = observer(function ErrorMessage({
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

export default ErrorMessage
