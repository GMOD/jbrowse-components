import React from 'react'
import { observer } from 'mobx-react'

// locals
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'
import ImportForm from './ImportForm'

type LSV = LinearSyntenyViewModel

const LinearSyntenyView = observer(({ model }: { model: LSV }) => {
  return !model.initialized ? (
    <ImportForm model={model} />
  ) : (
    <LinearComparativeViewComponent model={model} />
  )
})

export default LinearSyntenyView
